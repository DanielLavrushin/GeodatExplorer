package geodat

import (
	"fmt"
	"net/netip"
	"os"
	"regexp"
	"strings"

	"github.com/urlesistiana/v2dat/v2data"
)

// matcher tests candidate strings against a query, either as a substring or as
// a compiled regular expression.
type matcher struct {
	re     *regexp.Regexp
	needle string
	fold   bool
}

// newMatcher compiles query according to opts. It returns an error only when
// opts.Regex is set and query is not a valid RE2 expression.
func newMatcher(query string, opts SearchOptions) (*matcher, error) {
	if opts.Regex {
		expr := query
		if !opts.CaseSensitive {
			// (?i) applies to the remainder of the pattern, including across
			// top-level alternations.
			expr = "(?i)" + expr
		}
		re, err := regexp.Compile(expr)
		if err != nil {
			// The wrapped error already quotes the offending pattern.
			return nil, fmt.Errorf("invalid regular expression: %w", err)
		}
		return &matcher{re: re}, nil
	}

	if opts.CaseSensitive {
		return &matcher{needle: query}, nil
	}
	return &matcher{needle: strings.ToLower(query), fold: true}, nil
}

func (m *matcher) matches(s string) bool {
	if m.re != nil {
		return m.re.MatchString(s)
	}
	if m.fold {
		return strings.Contains(strings.ToLower(s), m.needle)
	}
	return strings.Contains(s, m.needle)
}

func domainTypeName(t v2data.Domain_Type) string {
	switch t {
	case v2data.Domain_Plain:
		return "keyword"
	case v2data.Domain_Regex:
		return "regexp"
	case v2data.Domain_Full:
		return "full"
	case v2data.Domain_Domain:
		return "domain"
	default:
		return "domain"
	}
}

func SearchGeoSite(geodataPath string, query string, opts SearchOptions) ([]SearchResult, error) {
	if geodataPath == "" || query == "" {
		return nil, nil
	}

	m, err := newMatcher(query, opts)
	if err != nil {
		return nil, err
	}

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
			if !m.matches(d.Value) {
				continue
			}
			matches = append(matches, Entry{
				Type:  domainTypeName(d.Type),
				Value: d.Value,
			})
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

func SearchGeoIP(geodataPath string, query string, opts SearchOptions) ([]SearchResult, error) {
	if geodataPath == "" || query == "" {
		return nil, nil
	}

	// Trimming makes IP/CIDR parsing forgiving, but it would silently alter a
	// regular expression, so leave regex queries untouched.
	if !opts.Regex {
		query = strings.TrimSpace(query)
	}

	m, err := newMatcher(query, opts)
	if err != nil {
		return nil, err
	}

	data, err := os.ReadFile(geodataPath)
	if err != nil {
		return nil, err
	}

	geoIPList, err := v2data.LoadGeoIPListFromDAT(data)
	if err != nil {
		return nil, err
	}

	// Containment search only makes sense for a literal IP/CIDR query. In regex
	// mode the pattern is matched against the textual CIDR instead.
	var queryPrefix netip.Prefix
	useContainment := false
	if !opts.Regex {
		queryAddr, addrErr := netip.ParseAddr(query)
		parsedPrefix, prefixErr := netip.ParsePrefix(query)
		switch {
		case addrErr == nil:
			// A plain IP is treated as a /32 or /128 prefix.
			bits := 32
			if queryAddr.Is6() {
				bits = 128
			}
			queryPrefix = netip.PrefixFrom(queryAddr, bits)
			useContainment = true
		case prefixErr == nil:
			queryPrefix = parsedPrefix
			useContainment = true
		}
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
				continue
			}

			// Fall back to substring/regex match on the textual CIDR
			value := prefix.String()
			if m.matches(value) {
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

// prefixContains reports whether outer fully contains inner.
func prefixContains(outer, inner netip.Prefix) bool {
	return outer.Contains(inner.Addr()) && outer.Bits() <= inner.Bits()
}
