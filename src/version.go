package main

// version is injected at build time via:
//
//	wails build -ldflags "-X main.version=1.2.3"
//
// It stays "dev" for plain `go build` / `wails dev` runs.
var version = "dev"

// GetVersion returns the application version
func (a *App) GetVersion() string {
	return version
}
