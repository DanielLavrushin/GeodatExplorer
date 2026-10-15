package geodat

import (
	"bufio"
	"encoding/binary"
	"fmt"
	"io"
	"net/netip"
	"os"
	"strings"

	"github.com/urlesistiana/v2dat/v2data"
	"google.golang.org/protobuf/proto"
)

func UnpackGeoIP(args *UnpackArgs) error {
	filePath, wantTags := args.File, args.Filters

	save := func(tag string, geo *v2data.GeoIP) error {
		return convertV2CidrToText(geo.GetCidr(), os.Stdout)
	}

	if len(wantTags) != 0 {
		return streamGeoIP(filePath, wantTags, save)
	}

	b, err := os.ReadFile(filePath)
	if err != nil {
		return err
	}
	geoIPList, err := v2data.LoadGeoIPListFromDAT(b)
	if err != nil {
		return err
	}
	for _, geo := range geoIPList.GetEntry() {
		tag := strings.ToLower(geo.GetCountryCode())
		if err := save(tag, geo); err != nil {
			return err
		}
	}
	return nil
}

func streamGeoIP(file string, filters []string, save func(string, *v2data.GeoIP) error) error {
	f, err := os.Open(file)
	if err != nil {
		return err
	}
	defer f.Close()

	want := map[string]struct{}{}
	for _, tag := range filters {
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
		var geo v2data.GeoIP
		if err := proto.Unmarshal(msg, &geo); err != nil {
			return err
		}
		if err := save(tag, &geo); err != nil {
			return err
		}
		got[tag] = struct{}{}
		if len(got) == len(want) {
			return nil
		}
	}
	return nil
}

func convertV2CidrToText(cidr []*v2data.CIDR, w io.Writer) error {
	bw := bufio.NewWriter(w)
	for i, record := range cidr {
		ip, ok := netip.AddrFromSlice(record.Ip)
		if !ok {
			return fmt.Errorf("invalid ip at index #%d, %s", i, record.Ip)
		}
		prefix, err := ip.Prefix(int(record.Prefix))
		if !ok {
			return fmt.Errorf("invalid prefix at index #%d, %w", i, err)
		}

		if _, err := bw.WriteString(prefix.String()); err != nil {
			return err
		}
		if _, err := bw.WriteRune('\n'); err != nil {
			return err
		}
	}
	return bw.Flush()
}
func SaveFilteredGeoIP(srcPath, dstPath string, selectedCategories []string) error {
	if len(selectedCategories) == 0 {
		return fmt.Errorf("no categories selected")
	}

	data, err := os.ReadFile(srcPath)
	if err != nil {
		return fmt.Errorf("failed to read source file: %w", err)
	}

	geoIPList, err := v2data.LoadGeoIPListFromDAT(data)
	if err != nil {
		return fmt.Errorf("failed to load geoip list: %w", err)
	}

	targetSet := make(map[string]struct{}, len(selectedCategories))
	for _, c := range selectedCategories {
		targetSet[strings.ToLower(strings.TrimSpace(c))] = struct{}{}
	}

	filteredList := &v2data.GeoIPList{
		Entry: make([]*v2data.GeoIP, 0),
	}

	for _, entry := range geoIPList.GetEntry() {
		tag := strings.ToLower(entry.GetCountryCode())
		if _, ok := targetSet[tag]; ok {
			filteredList.Entry = append(filteredList.Entry, entry)
		}
	}

	if len(filteredList.Entry) == 0 {
		return fmt.Errorf("none of the selected categories were found in the file")
	}

	outBytes, err := proto.Marshal(filteredList)
	if err != nil {
		return fmt.Errorf("failed to marshal filtered geoip: %w", err)
	}

	if err := os.WriteFile(dstPath, outBytes, 0644); err != nil {
		return fmt.Errorf("failed to write output file: %w", err)
	}

	return nil
}
