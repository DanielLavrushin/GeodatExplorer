package geodat

type UnpackArgs struct {
	File    string
	Filters []string
}

type Entry struct {
	Type  string `json:"type"` // "domain", "full", "keyword", "regexp", "cidr"
	Value string `json:"value"`
}
