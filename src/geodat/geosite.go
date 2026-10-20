package geodat

import (
	"bufio"
	"encoding/binary"
	"fmt"
	"io"
	"net/netip"
	"os"
	"sort"
	"strings"

	"github.com/urlesistiana/v2dat/v2data"
	"google.golang.org/protobuf/proto"
)

func UnpackGeoSite(args *UnpackArgs) error {
	filePath, suffixes := args.File, args.Filters

	save := func(suffix string, domains []*v2data.Domain) error {
		return convertV2DomainToText(domains, os.Stdout)
	}

	if len(suffixes) != 0 {
		return streamGeoSite(filePath, suffixes, save)
	}
	data, err := os.ReadFile(filePath)
	if err != nil {
		return err
	}
	geoSiteList, err := v2data.LoadGeoSiteList(data)
	if err != nil {
		return err
	}
	entries := make(map[string][]*v2data.Domain, len(geoSiteList.GetEntry()))
	for _, gs := range geoSiteList.GetEntry() {
		tag := strings.ToLower(gs.GetCountryCode())
		entries[tag] = gs.GetDomain()
	}
	for tag, domains := range entries {
		if err := save(tag, domains); err != nil {
			return fmt.Errorf("failed to save %s: %w", tag, err)
		}
	}
	return nil
}

func readCountryCode(msg []byte) (string, error) {
	if len(msg) == 0 || msg[0] != 0x0A {
		return "", fmt.Errorf("bad key")
	}
	l, n := binary.Uvarint(msg[1:])
	if n <= 0 {
		return "", fmt.Errorf("bad varint")
	}
	start := 1 + n
	end := start + int(l)
	if end > len(msg) {
		return "", fmt.Errorf("country code exceeds message length")
	}
	return strings.ToLower(string(msg[start:end])), nil
}

func streamGeoSite(file string, filters []string, save func(string, []*v2data.Domain) error) error {
	f, err := os.Open(file)
	if err != nil {
		return err
	}
	defer f.Close()
	want := map[string]struct{}{}
	for _, s := range filters {
		tag, _ := splitAttrs(s)
		want[strings.ToLower(tag)] = struct{}{}
	}
	got := map[string]struct{}{}
	r := bufio.NewReaderSize(f, 32*1024)
	for {
		tagByte, err := r.ReadByte()
		if err == io.EOF {
			break
		}
		if err != nil {
			return err
		}
		if tagByte != 0x0A {
			return fmt.Errorf("unexpected wire tag %02X", tagByte)
		}
		length, err := binary.ReadUvarint(r)
		if err != nil {
			return err
		}
		msg := make([]byte, length)
		if _, err := io.ReadFull(r, msg); err != nil {
			return err
		}
		tag, err := readCountryCode(msg)
		if err != nil {
			return err
		}
		if _, ok := want[tag]; !ok {
			continue
		}
		var gs v2data.GeoSite
		if err := proto.Unmarshal(msg, &gs); err != nil {
			return err
		}
		if err := save(tag, gs.GetDomain()); err != nil {
			return err
		}
		got[tag] = struct{}{}
		if len(got) == len(want) {
			return nil
		}
	}
	return nil
}

func convertV2DomainToText(dom []*v2data.Domain, w io.Writer) error {
	b := strings.Builder{}
	// crude pre‑size: avg 30 bytes per line
	b.Grow(len(dom) * 30)

	for _, d := range dom {
		switch d.Type {
		case v2data.Domain_Plain:
			b.WriteString("keyword:")
		case v2data.Domain_Regex:
			b.WriteString("regexp:")
		case v2data.Domain_Full:
			b.WriteString("full:")
		}
		b.WriteString(d.Value)
		b.WriteByte('\n')
	}
	_, err := io.WriteString(w, b.String())
	return err
}

func DetectFileType(path string) string {
	if path == "" {
		return ""
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return ""
	}

	geoipScore := 0
	geositeScore := 0

	if giList, err := v2data.LoadGeoIPListFromDAT(data); err == nil {
		for _, entry := range giList.GetEntry() {
			cc := entry.GetCountryCode()
			if len(cc) >= 2 && len(entry.GetCidr()) > 0 {
				first := entry.GetCidr()[0]
				if _, ok := netip.AddrFromSlice(first.Ip); ok && first.Prefix <= 128 {
					geoipScore++
				}
			}
		}
	}

	if gsList, err := v2data.LoadGeoSiteList(data); err == nil {
		for _, entry := range gsList.GetEntry() {
			cc := entry.GetCountryCode()
			if len(cc) >= 2 && len(entry.GetDomain()) > 0 {
				first := entry.GetDomain()[0]
				if len(first.Value) > 0 && isPrintableASCII(first.Value) {
					geositeScore++
				}
			}
		}
	}

	if geoipScore > geositeScore {
		return "geoip"
	}
	if geositeScore > 0 {
		return "geosite"
	}
	return ""
}

func isPrintableASCII(s string) bool {
	for _, r := range s {
		if r < 0x20 || r > 0x7e {
			return false
		}
	}
	return true
}

func ListGeoSiteCategories(path string) ([]string, error) {
	if path == "" {
		return nil, nil
	}

	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	geoSiteList, err := v2data.LoadGeoSiteList(data)
	if err != nil {
		return nil, err
	}

	categories := make([]string, 0, len(geoSiteList.GetEntry()))
	for _, gs := range geoSiteList.GetEntry() {
		categories = append(categories, strings.ToLower(gs.GetCountryCode()))
	}
	sort.Strings(categories)
	return categories, nil
}

func ListGeoIPCategories(path string) ([]string, error) {
	if path == "" {
		return nil, nil
	}

	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	geoIPList, err := v2data.LoadGeoIPListFromDAT(data)
	if err != nil {
		return nil, err
	}

	categories := make([]string, 0, len(geoIPList.GetEntry()))
	for _, geo := range geoIPList.GetEntry() {
		categories = append(categories, strings.ToLower(geo.GetCountryCode()))
	}
	sort.Strings(categories)
	return categories, nil
}
func SaveFilteredGeoSite(srcPath, dstPath string, selectedCategories []string, excluded map[string][]string, added map[string][]Entry) error {
	if len(selectedCategories) == 0 {
		return fmt.Errorf("no categories selected")
	}

	data, err := os.ReadFile(srcPath)
	if err != nil {
		return fmt.Errorf("failed to read source file: %w", err)
	}

	geoSiteList, err := v2data.LoadGeoSiteList(data)
	if err != nil {
		return fmt.Errorf("failed to parse geosite data: %w", err)
	}

	targetSet := make(map[string]struct{}, len(selectedCategories))
	for _, c := range selectedCategories {
		targetSet[strings.ToLower(strings.TrimSpace(c))] = struct{}{}
	}

	filteredList := &v2data.GeoSiteList{
		Entry: make([]*v2data.GeoSite, 0),
	}

	for _, site := range geoSiteList.GetEntry() {
		catKey := strings.ToLower(site.GetCountryCode())
		if _, ok := targetSet[catKey]; !ok {
			continue
		}

		// Собираем множество исключённых значений для этой категории
		exclSet := make(map[string]struct{})
		for k, list := range excluded {
			if strings.ToLower(k) == catKey {
				for _, val := range list {
					exclSet[val] = struct{}{}
				}
			}
		}

		newDomains := make([]*v2data.Domain, 0, len(site.GetDomain()))
		for _, d := range site.GetDomain() {
			if _, isExcl := exclSet[d.GetValue()]; !isExcl {
				newDomains = append(newDomains, d)
			}
		}

		// Добавляем пользовательские домены для этой категории
		for k, list := range added {
			if strings.ToLower(k) == catKey {
				for _, item := range list {
					val := strings.TrimSpace(item.Value)
					if val == "" {
						continue
					}
					if _, isExcl := exclSet[val]; isExcl {
						continue
					}
					dType := v2data.Domain_Domain
					switch strings.ToLower(item.Type) {
					case "full":
						dType = v2data.Domain_Full
					case "keyword", "plain":
						dType = v2data.Domain_Plain
					case "regexp", "regex":
						dType = v2data.Domain_Regex
					}
					newDomains = append(newDomains, &v2data.Domain{
						Type:  dType,
						Value: val,
					})
				}
			}
		}

		if len(newDomains) > 0 {
			filteredList.Entry = append(filteredList.Entry, &v2data.GeoSite{
				CountryCode: site.GetCountryCode(),
				Domain:      newDomains,
			})
		}
	}

	if len(filteredList.Entry) == 0 {
		return fmt.Errorf("none of the selected categories/entries remained after filtering")
	}

	outBytes, err := proto.Marshal(filteredList)
	if err != nil {
		return fmt.Errorf("failed to marshal filtered geosite: %w", err)
	}

	return os.WriteFile(dstPath, outBytes, 0644)
}
