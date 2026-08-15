package geodat

type UnpackArgs struct {
	File    string
	Filters []string
}

type Entry struct {
	Type  string `json:"type"` // "domain", "full", "keyword", "regexp", "cidr"
	Value string `json:"value"`
}

type SearchResult struct {
	Category string  `json:"category"`
	Matches  []Entry `json:"matches"`
	Total    int     `json:"total"`
}

// SearchOptions controls how a search query is interpreted.
type SearchOptions struct {
	// Regex treats the query as an RE2 regular expression instead of a plain
	// substring.
	Regex bool `json:"regex"`
	// CaseSensitive disables the default case-insensitive matching.
	CaseSensitive bool `json:"caseSensitive"`
}
