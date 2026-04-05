package geodat

import (
	"net/netip"
	"os"
	"strings"

	"github.com/urlesistiana/v2dat/v2data"
)

func SearchGeoSite(geodataPath string, query string) ([]SearchResult, error) {
	if geodataPath == "" || query == "" {
		return nil, nil
	}

	query = strings.ToLower(query)
	data, err := os.ReadFile(geodataPath)
	if err != nil {
		return nil, err
	}

	geoSiteList, err := v2data.LoadGeoSiteList(data)
	if err != nil {
		return nil, err
	}

	var results []SearchResult

	for _, gs := range geoSiteList.GetEntry() {
		category := strings.ToLower(gs.GetCountryCode())
		var matches []Entry

		for _, d := range gs.GetDomain() {
			value := strings.ToLower(d.Value)
			if strings.Contains(value, query) {
				entry := Entry{Value: d.Value}
				switch d.Type {
				case v2data.Domain_Plain:
					entry.Type = "keyword"
				case v2data.Domain_Regex:
					entry.Type = "regexp"
				case v2data.Domain_Full:
					entry.Type = "full"
				case v2data.Domain_Domain:
					entry.Type = "domain"
				default:
					entry.Type = "domain"
				}
				matches = append(matches, entry)
			}
		}

		if len(matches) > 0 {
			// Limit matches to first 10 for preview
			preview := matches
			if len(preview) > 10 {
				preview = preview[:10]
			}
			results = append(results, SearchResult{
				Category: category,
				Matches:  preview,
				Total:    len(matches),
			})
		}
	}

	return results, nil
}

func SearchGeoIP(geodataPath string, query string) ([]SearchResult, error) {
	if geodataPath == "" || query == "" {
		return nil, nil
	}

	query = strings.TrimSpace(query)
	data, err := os.ReadFile(geodataPath)
	if err != nil {
		return nil, err
	}

	geoIPList, err := v2data.LoadGeoIPListFromDAT(data)
	if err != nil {
		return nil, err
	}

	// Try to parse query as IP or CIDR for containment search
	queryAddr, addrErr := netip.ParseAddr(query)
	queryPrefix, prefixErr := netip.ParsePrefix(query)

	useContainment := addrErr == nil || prefixErr == nil

	// If query is a plain IP, treat it as a /32 or /128 prefix
	if addrErr == nil && prefixErr != nil {
		bits := 32
		if queryAddr.Is6() {
			bits = 128
		}
		queryPrefix = netip.PrefixFrom(queryAddr, bits)
	}

	var results []SearchResult

	for _, geo := range geoIPList.GetEntry() {
		category := strings.ToLower(geo.GetCountryCode())
		var matches []Entry

		for _, cidr := range geo.GetCidr() {
			ip, ok := netip.AddrFromSlice(cidr.Ip)
			if !ok {
				continue
			}
			prefix, err := ip.Prefix(int(cidr.Prefix))
			if err != nil {
				continue
			}

			if useContainment {
				// Check if the entry's CIDR contains the query IP/prefix
				// or if the query prefix contains the entry's CIDR
				if prefixContains(prefix, queryPrefix) || prefixContains(queryPrefix, prefix) {
					matches = append(matches, Entry{
						Type:  "cidr",
						Value: prefix.String(),
					})
				}
			} else {
				// Fall back to substring match for partial queries
				value := prefix.String()
				if strings.Contains(strings.ToLower(value), strings.ToLower(query)) {
					matches = append(matches, Entry{
						Type:  "cidr",
						Value: value,
					})
				}
			}
		}

		if len(matches) > 0 {
			preview := matches
			if len(preview) > 10 {
				preview = preview[:10]
			}
			results = append(results, SearchResult{
				Category: category,
				Matches:  preview,
				Total:    len(matches),
			})
		}
	}

	return results, nil
}

// prefixContains reports whether outer fully contains inner.
func prefixContains(outer, inner netip.Prefix) bool {
	return outer.Contains(inner.Addr()) && outer.Bits() <= inner.Bits()
}
