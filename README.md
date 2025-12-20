# GeodatExplorer

A cross-platform GUI application for browsing and exploring v2ray geosite and geoip DAT files.

## Overview

GeodatExplorer provides a user-friendly interface to inspect the contents of [v2ray/xray geodata files](https://github.com/v2fly/domain-list-community) (`geosite.dat` and `geoip.dat`). These files contain domain and IP routing rules used by proxy tools like v2ray, xray, sing-box, and others.

Instead of manually parsing binary protobuf files or relying on command-line tools, GeodatExplorer lets you:

- Browse all categories in a DAT file
- View entries with type indicators (domain, full, keyword, regexp, CIDR, include)
- Search globally across all categories to find which rules contain a specific domain or IP
- Filter categories and entries in real-time

## Features

- **Category browser** — Lists all categories with filtering
- **Entry viewer** — Shows entries with color-coded types
- **Reverse search** — Find which categories contain a specific domain/IP pattern
- **Cross-platform** — Runs on `Linux`, `Windows`, and `macOS`

## Supported Platforms

| Platform       | Architecture |
|----------------|--------------|
| Linux          | amd64, arm64 |
| Windows        | amd64        |
| macOS          | amd64, arm64 |

## Installation

Download the latest release for your platform from the [Releases](https://github.com/DanielLavrushin/GeodatExplorer/releases) page.

### Linux

```bash
tar -xzf gde-linux-amd64.tar.gz
./gde-linux-amd64/gde
```

### Windows

Extract `gde-windows-amd64.zip` and run `gde.exe`.

### macOS

Extract `gde-darwin-*.tar.gz` and open `gde.app`.

## Building from Source

### Prerequisites

- Go 1.23+
- Node.js 22+
- pnpm
- Wails CLI v2

### Build

```bash
# Install Wails CLI
go install github.com/wailsapp/wails/v2/cmd/wails@latest

# Clone and build
git clone https://github.com/DanielLavrushin/GeodatExplorer.git
cd GeodatExplorer/src
wails build
```

### Development

```bash
cd src
wails dev -tags webkit2_41  # Linux requires webkit2_41 tag
```

## License

MIT
