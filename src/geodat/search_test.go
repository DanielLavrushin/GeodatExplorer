package geodat

import (
	"testing"

	"github.com/urlesistiana/v2dat/v2data"
)

func TestDomainTypeName(t *testing.T) {
	cases := map[v2data.Domain_Type]string{
		v2data.Domain_Plain:  "keyword",
		v2data.Domain_Regex:  "regexp",
		v2data.Domain_Full:   "full",
		v2data.Domain_Domain: "domain",
	}
	for in, want := range cases {
		if got := domainTypeName(in); got != want {
			t.Errorf("domainTypeName(%v) = %q, want %q", in, got, want)
		}
	}
	if got := domainTypeName(v2data.Domain_Type(99)); got != "domain" {
		t.Errorf("unknown type = %q, want %q", got, "domain")
	}
}

func TestNewMatcher(t *testing.T) {
	tests := []struct {
		name    string
		query   string
		opts    SearchOptions
		matches []string
		misses  []string
	}{
		{
			name:    "plain is case-insensitive by default",
			query:   "GooGle",
			matches: []string{"google.com", "GOOGLE.COM", "www.google.co.uk"},
			misses:  []string{"example.com"},
		},
		{
			name:    "plain case-sensitive",
			query:   "Google",
			opts:    SearchOptions{CaseSensitive: true},
			matches: []string{"my.Google.test"},
			misses:  []string{"google.com", "GOOGLE.COM"},
		},
		{
			name:    "regex is case-insensitive by default",
			query:   `^ads?\..*\.com$`,
			opts:    SearchOptions{Regex: true},
			matches: []string{"ad.tracker.com", "ADS.Tracker.COM"},
			misses:  []string{"ads.tracker.net", "www.ads.tracker.com"},
		},
		{
			name:    "regex case-sensitive",
			query:   `^ads\.`,
			opts:    SearchOptions{Regex: true, CaseSensitive: true},
			matches: []string{"ads.example.com"},
			misses:  []string{"ADS.example.com"},
		},
		{
			// (?i) is prepended for insensitive mode; verify the flag spans a
			// top-level alternation rather than only the first branch.
			name:    "regex insensitivity spans alternation",
			query:   `foo|bar`,
			opts:    SearchOptions{Regex: true},
			matches: []string{"FOO.com", "BAR.com"},
			misses:  []string{"baz.com"},
		},
		{
			name:    "regex matches cidr text",
			query:   `^10\.`,
			opts:    SearchOptions{Regex: true},
			matches: []string{"10.0.0.0/8"},
			misses:  []string{"110.0.0.0/8", "192.168.0.0/16"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			m, err := newMatcher(tt.query, tt.opts)
			if err != nil {
				t.Fatalf("newMatcher(%q) returned error: %v", tt.query, err)
			}
			for _, s := range tt.matches {
				if !m.matches(s) {
					t.Errorf("expected %q to match %q", s, tt.query)
				}
			}
			for _, s := range tt.misses {
				if m.matches(s) {
					t.Errorf("expected %q not to match %q", s, tt.query)
				}
			}
		})
	}
}

func TestNewMatcherInvalidRegex(t *testing.T) {
	if _, err := newMatcher("(unclosed", SearchOptions{Regex: true}); err == nil {
		t.Fatal("expected an error for an invalid regular expression")
	}

	// The same string is a perfectly good substring query.
	m, err := newMatcher("(unclosed", SearchOptions{})
	if err != nil {
		t.Fatalf("plain mode should not validate regex syntax: %v", err)
	}
	if !m.matches("a (unclosed thing") {
		t.Error("expected plain substring match")
	}
}

func TestSearchEmptyQueryReturnsNil(t *testing.T) {
	// An invalid regex must not surface as an error before the empty-query guard.
	results, err := SearchGeoSite("/nonexistent.dat", "", SearchOptions{Regex: true})
	if err != nil || results != nil {
		t.Fatalf("expected (nil, nil), got (%v, %v)", results, err)
	}
	results, err = SearchGeoIP("/nonexistent.dat", "", SearchOptions{Regex: true})
	if err != nil || results != nil {
		t.Fatalf("expected (nil, nil), got (%v, %v)", results, err)
	}
}
