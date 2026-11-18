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
	// Deliberately not masked: source files may carry host bits.
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

	// The UI shows the first record as 192.0.2.0/24, so that is what it sends.
	shown := exportedIPs(t, src, "test")
	if !reflect.DeepEqual(shown, []string{"192.0.2.0/24", "198.51.100.0/24"}) {
		t.Fatalf("loader shows %v", shown)
	}

	dst := filepath.Join(t.TempDir(), "out.dat")
	err := SaveFilteredGeoIP(src, dst, []string{"test"},
		map[string][]string{"test": {"192.0.2.0/24"}}, nil)
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
