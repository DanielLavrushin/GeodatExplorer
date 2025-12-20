package geodat

import (
	"bufio"
	"encoding/binary"
	"io"
	"os"
	"sort"
	"strings"

	"github.com/daniellavrushin/geodatexplorer/log"
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
			return log.Errorf("failed to save %s: %w", tag, err)
		}
	}
	return nil
}

func readCountryCode(msg []byte) (string, error) {
	if len(msg) == 0 || msg[0] != 0x0A {
		return "", log.Errorf("bad key")
	}
	l, n := binary.Uvarint(msg[1:])
	if n <= 0 {
		return "", log.Errorf("bad varint")
	}
	start := 1 + n
	end := start + int(l)
	if end > len(msg) {
		return "", log.Errorf("string truncated")
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
			return log.Errorf("unexpected wire tag %02X", tagByte)
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

// ListGeoIPCategories returns all category names in a geoip file
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
