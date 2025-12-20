package geodat

import (
	"strings"
)

func splitAttrs(s string) (string, map[string]struct{}) {
	tag, attrs, ok := strings.Cut(s, "@")
	if ok {
		m := make(map[string]struct{})
		for _, attr := range strings.Split(attrs, "@") {
			m[attr] = struct{}{}
		}
		return tag, m
	}
	return s, nil
}
