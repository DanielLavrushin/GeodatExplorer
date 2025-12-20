package geodat

import (
	"net/netip"

	"github.com/urlesistiana/v2dat/v2data"
)

// LoadDomainsFromCategories loads domains from geodata file for specified categories
func LoadDomainsFromCategories(geodataPath string, categories []string) ([]string, error) {
	if geodataPath == "" || len(categories) == 0 {
		return nil, nil
	}

	allDomains := []string{}

	// Create a callback that collects domains
	save := func(tag string, domainList []*v2data.Domain) error {
		for _, d := range domainList {
			// Extract domain value based on type
			domain := extractDomainValue(d)
			if domain != "" {
				allDomains = append(allDomains, domain)
			}
		}
		return nil
	}

	// Stream and process each category
	if err := streamGeoSite(geodataPath, categories, save); err != nil {
		return nil, err
	}

	return allDomains, nil
}

func LoadIpsFromCategories(geodataPath string, categories []string) ([]string, error) {
	if geodataPath == "" || len(categories) == 0 {
		return nil, nil
	}

	allIps := []string{}

	save := func(tag string, geo *v2data.GeoIP) error {
		// Collect IPs from CIDR list
		for _, cidr := range geo.GetCidr() {
			ip, ok := netip.AddrFromSlice(cidr.Ip)
			if !ok {
				continue
			}
			prefix, err := ip.Prefix(int(cidr.Prefix))
			if err != nil {
				continue
			}
			allIps = append(allIps, prefix.String())
		}
		return nil
	}

	if err := streamGeoIP(geodataPath, categories, save); err != nil {
		return nil, err
	}

	return allIps, nil
}

// extractDomainValue extracts the domain string from a Domain record
func extractDomainValue(d *v2data.Domain) string {
	switch d.Type {
	case v2data.Domain_Plain:
		// Plain/keyword match - just the value
		return d.Value
	case v2data.Domain_Regex:
		// regex patterns - they need special handling
		return "regexp:" + d.Value
	case v2data.Domain_Full:
		// Full domain match
		return d.Value
	case v2data.Domain_Domain:
		// Domain and subdomains
		return d.Value
	default:
		return d.Value
	}
}
