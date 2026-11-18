package geodat

import (
	"net/netip"
	"strings"

	"github.com/urlesistiana/v2dat/v2data"
)

func LoadDomainsFromCategories(geodataPath string, categories []string) ([]Entry, error) {
	if geodataPath == "" || len(categories) == 0 {
		return nil, nil
	}

	var allEntries []Entry

	save := func(tag string, domainList []*v2data.Domain) error {
		for _, d := range domainList {
			allEntries = append(allEntries, domainEntry(d))
		}
		return nil
	}

	if err := streamGeoSite(geodataPath, categories, save); err != nil {
		return nil, err
	}

	return allEntries, nil
}

func LoadIpsFromCategories(geodataPath string, categories []string) ([]Entry, error) {
	if geodataPath == "" || len(categories) == 0 {
		return nil, nil
	}

	var allEntries []Entry

	save := func(tag string, geo *v2data.GeoIP) error {
		for _, cidr := range geo.GetCidr() {
			if entry, ok := cidrEntry(cidr); ok {
				allEntries = append(allEntries, entry)
			}
		}
		return nil
	}

	if err := streamGeoIP(geodataPath, categories, save); err != nil {
		return nil, err
	}

	return allEntries, nil
}

func entryKey(e Entry) string {
	return e.Type + ":" + e.Value
}

func domainEntry(d *v2data.Domain) Entry {
	if value, ok := strings.CutPrefix(d.GetValue(), "include:"); ok {
		return Entry{Type: "include", Value: value}
	}
	entry := Entry{Type: "domain", Value: d.GetValue()}
	switch d.GetType() {
	case v2data.Domain_Plain:
		entry.Type = "keyword"
	case v2data.Domain_Regex:
		entry.Type = "regexp"
	case v2data.Domain_Full:
		entry.Type = "full"
	}
	return entry
}

func cidrEntry(c *v2data.CIDR) (Entry, bool) {
	ip, ok := netip.AddrFromSlice(c.GetIp())
	if !ok {
		return Entry{}, false
	}
	prefix, err := ip.Prefix(int(c.GetPrefix()))
	if err != nil {
		return Entry{}, false
	}
	return Entry{Type: "cidr", Value: prefix.String()}, true
}

func parseCustomCIDR(s string) (netip.Prefix, error) {
	if !strings.Contains(s, "/") {
		addr, err := netip.ParseAddr(s)
		if err != nil {
			return netip.Prefix{}, err
		}
		return netip.PrefixFrom(addr.WithZone(""), addr.BitLen()), nil
	}
	prefix, err := netip.ParsePrefix(s)
	if err != nil {
		return netip.Prefix{}, err
	}
	return prefix.Masked(), nil
}
