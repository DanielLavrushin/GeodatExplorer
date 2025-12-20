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

	query = strings.ToLower(query)
	data, err := os.ReadFile(geodataPath)
	if err != nil {
		return nil, err
	}

	geoIPList, err := v2data.LoadGeoIPListFromDAT(data)
	if err != nil {
		return nil, err
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
			value := prefix.String()
			if strings.Contains(strings.ToLower(value), query) {
				matches = append(matches, Entry{
					Type:  "cidr",
					Value: value,
				})
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
