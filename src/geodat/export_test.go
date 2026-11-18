package geodat

import (
	"net/netip"
	"os"
	"path/filepath"
	"reflect"
	"strconv"
	"strings"
	"testing"

	"github.com/urlesistiana/v2dat/v2data"
	"google.golang.org/protobuf/proto"
)

func writeDat(t *testing.T, msg proto.Message) string {
	t.Helper()
	data, err := proto.Marshal(msg)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	path := filepath.Join(t.TempDir(), "src.dat")
	if err := os.WriteFile(path, data, 0o644); err != nil {
		t.Fatalf("write: %v", err)
	}
	return path
}

func cidr(t *testing.T, s string) *v2data.CIDR {
	t.Helper()
	ip, bits, _ := strings.Cut(s, "/")
	addr, err := netip.ParseAddr(ip)
	if err != nil {
		t.Fatalf("parse %q: %v", s, err)
	}
	n, err := strconv.Atoi(bits)
	if err != nil {
		t.Fatalf("parse %q: %v", s, err)
	}
	return &v2data.CIDR{Ip: addr.AsSlice(), Prefix: uint32(n)}
}

func exportedIPs(t *testing.T, path, category string) []string {
	t.Helper()
	entries, err := LoadIpsFromCategories(path, []string{category})
	if err != nil {
		t.Fatalf("reload: %v", err)
	}
	values := make([]string, 0, len(entries))
	for _, e := range entries {
		values = append(values, e.Value)
	}
	return values
}

func TestSaveFilteredGeoIPExcludesByDisplayedCIDR(t *testing.T) {
	src := writeDat(t, &v2data.GeoIPList{Entry: []*v2data.GeoIP{{
		CountryCode: "TEST",
		Cidr:        []*v2data.CIDR{cidr(t, "192.0.2.5/24"), cidr(t, "198.51.100.0/24")},
	}}})

	shown := exportedIPs(t, src, "test")
	if !reflect.DeepEqual(shown, []string{"192.0.2.0/24", "198.51.100.0/24"}) {
		t.Fatalf("loader shows %v", shown)
	}

	dst := filepath.Join(t.TempDir(), "out.dat")
	err := SaveFilteredGeoIP(src, dst, []string{"test"},
		map[string][]string{"test": {"cidr:192.0.2.0/24"}}, nil)
	if err != nil {
		t.Fatalf("export: %v", err)
	}
	if got := exportedIPs(t, dst, "test"); !reflect.DeepEqual(got, []string{"198.51.100.0/24"}) {
		t.Fatalf("exported %v, want only 198.51.100.0/24", got)
	}
}

func TestSaveFilteredGeoIPMasksAddedCIDRs(t *testing.T) {
	src := writeDat(t, &v2data.GeoIPList{Entry: []*v2data.GeoIP{{
		CountryCode: "TEST",
		Cidr:        []*v2data.CIDR{cidr(t, "198.51.100.0/24")},
	}}})

	dst := filepath.Join(t.TempDir(), "out.dat")
	err := SaveFilteredGeoIP(src, dst, []string{"test"}, nil, map[string][]Entry{
		"test": {
			{Type: "cidr", Value: "10.1.2.3/8"},
			{Type: "cidr", Value: "203.0.113.7"},
			{Type: "cidr", Value: "2001:db8::1/32"},
		},
	})
	if err != nil {
		t.Fatalf("export: %v", err)
	}

	data, err := os.ReadFile(dst)
	if err != nil {
		t.Fatalf("read: %v", err)
	}
	list, err := v2data.LoadGeoIPListFromDAT(data)
	if err != nil {
		t.Fatalf("parse: %v", err)
	}
	var got []string
	for _, c := range list.GetEntry()[0].GetCidr() {
		addr, _ := netip.AddrFromSlice(c.GetIp())
		got = append(got, netip.PrefixFrom(addr, int(c.GetPrefix())).String())
	}
	want := []string{"198.51.100.0/24", "10.0.0.0/8", "203.0.113.7/32", "2001:db8::/32"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("stored records %v, want %v", got, want)
	}
}

func TestSaveFilteredRejectsInvalidCustomEntries(t *testing.T) {
	ipSrc := writeDat(t, &v2data.GeoIPList{Entry: []*v2data.GeoIP{{
		CountryCode: "TEST",
		Cidr:        []*v2data.CIDR{cidr(t, "198.51.100.0/24")},
	}}})
	siteSrc := writeDat(t, &v2data.GeoSiteList{Entry: []*v2data.GeoSite{{
		CountryCode: "TEST",
		Domain:      []*v2data.Domain{{Type: v2data.Domain_Domain, Value: "example.com"}},
	}}})

	cases := []struct {
		name     string
		export   func(dst string, excluded map[string][]string, added map[string][]Entry) error
		bad      Entry
		errMatch string
	}{
		{
			name: "geoip",
			export: func(dst string, excluded map[string][]string, added map[string][]Entry) error {
				return SaveFilteredGeoIP(ipSrc, dst, []string{"test"}, excluded, added)
			},
			bad:      Entry{Type: "cidr", Value: "192.168.1.0/33"},
			errMatch: "192.168.1.0/33",
		},
		{
			name: "geosite",
			export: func(dst string, excluded map[string][]string, added map[string][]Entry) error {
				return SaveFilteredGeoSite(siteSrc, dst, []string{"test"}, excluded, added)
			},
			bad:      Entry{Type: "regexp", Value: "(unclosed"},
			errMatch: "(unclosed",
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			dst := filepath.Join(t.TempDir(), "out.dat")
			added := map[string][]Entry{"test": {tc.bad}}

			err := tc.export(dst, nil, added)
			if err == nil || !strings.Contains(err.Error(), tc.errMatch) {
				t.Fatalf("want error naming %q, got %v", tc.errMatch, err)
			}
			if _, statErr := os.Stat(dst); !os.IsNotExist(statErr) {
				t.Fatalf("output written despite error")
			}

			excluded := map[string][]string{"test": {entryKey(tc.bad)}}
			if err := tc.export(dst, excluded, added); err != nil {
				t.Fatalf("excluded invalid entry still failed: %v", err)
			}
		})
	}
}

func exportedDomains(t *testing.T, path, category string) []Entry {
	t.Helper()
	entries, err := LoadDomainsFromCategories(path, []string{category})
	if err != nil {
		t.Fatalf("reload: %v", err)
	}
	return entries
}

func TestSaveFilteredGeoSiteExcludesIncludeEntries(t *testing.T) {
	src := writeDat(t, &v2data.GeoSiteList{Entry: []*v2data.GeoSite{{
		CountryCode: "TEST",
		Domain: []*v2data.Domain{
			{Type: v2data.Domain_Domain, Value: "include:google"},
			{Type: v2data.Domain_Domain, Value: "example.com"},
		},
	}}})

	shown := exportedDomains(t, src, "test")
	if shown[0] != (Entry{Type: "include", Value: "google"}) {
		t.Fatalf("loader shows %v", shown)
	}

	dst := filepath.Join(t.TempDir(), "out.dat")
	err := SaveFilteredGeoSite(src, dst, []string{"test"},
		map[string][]string{"test": {"include:google"}}, nil)
	if err != nil {
		t.Fatalf("export: %v", err)
	}
	want := []Entry{{Type: "domain", Value: "example.com"}}
	if got := exportedDomains(t, dst, "test"); !reflect.DeepEqual(got, want) {
		t.Fatalf("exported %v, want %v", got, want)
	}
}

func TestSaveFilteredGeoSiteKeysRulesByTypeAndValue(t *testing.T) {
	src := writeDat(t, &v2data.GeoSiteList{Entry: []*v2data.GeoSite{{
		CountryCode: "TEST",
		Domain: []*v2data.Domain{
			{Type: v2data.Domain_Domain, Value: "example.com"},
			{Type: v2data.Domain_Full, Value: "example.com"},
		},
	}}})

	dst := filepath.Join(t.TempDir(), "out.dat")
	err := SaveFilteredGeoSite(src, dst, []string{"test"},
		map[string][]string{"test": {"domain:example.com", "keyword:extra"}},
		map[string][]Entry{"test": {
			{Type: "keyword", Value: "extra"},
			{Type: "include", Value: "other"},
		}})
	if err != nil {
		t.Fatalf("export: %v", err)
	}
	want := []Entry{
		{Type: "full", Value: "example.com"},
		{Type: "include", Value: "other"},
	}
	if got := exportedDomains(t, dst, "test"); !reflect.DeepEqual(got, want) {
		t.Fatalf("exported %v, want %v", got, want)
	}
}
