package main

import (
	"context"

	"github.com/daniellavrushin/geodatexplorer/geodat"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// Preferred window size, in logical pixels. The window shrinks to fit when the
// screen cannot accommodate it, see fitWindowToScreen.
const (
	defaultWidth  = 1024
	defaultHeight = 768
)

// Fraction of the screen the window may occupy on startup. The height leaves
// room for a taskbar plus the window title bar; Wails does not expose the
// taskbar-excluded work area, so we approximate it.
const (
	maxScreenWidthRatio  = 0.9
	maxScreenHeightRatio = 0.85
)

type App struct {
	ctx context.Context
}

func NewApp() *App {
	return &App{}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	a.fitWindowToScreen()
}

// fitWindowToScreen shrinks and re-centers the window when the default size does
// not fit on the current screen. Wails scales the requested size by the monitor
// DPI, so on a 1920x1080 screen at 150% scaling the default would be created at
// 1536x1152 physical pixels and hang off the top and bottom of the display.
func (a *App) fitWindowToScreen() {
	screens, err := runtime.ScreenGetAll(a.ctx)
	if err != nil || len(screens) == 0 {
		return
	}

	screen := screens[0]
	for _, s := range screens {
		if s.IsCurrent {
			screen = s
			break
		}
	}

	// Size is in logical pixels, the same units WindowSetSize expects.
	screenWidth, screenHeight := screen.Size.Width, screen.Size.Height
	if screenWidth <= 0 || screenHeight <= 0 {
		return
	}

	width := min(defaultWidth, int(float64(screenWidth)*maxScreenWidthRatio))
	height := min(defaultHeight, int(float64(screenHeight)*maxScreenHeightRatio))
	if width == defaultWidth && height == defaultHeight {
		return
	}

	runtime.WindowSetSize(a.ctx, width, height)
	runtime.WindowCenter(a.ctx)
}

func (a *App) DetectFileType(path string) string {
	return geodat.DetectFileType(path)
}

// OpenFileDialog opens a file picker
func (a *App) OpenFileDialog(title string) (string, error) {
	return runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title: title,
		Filters: []runtime.FileFilter{
			{DisplayName: "DAT Files", Pattern: "*.dat"},
			{DisplayName: "All Files", Pattern: "*"},
		},
	})
}

// ListGeoSiteCategories returns all category names in a geosite file
func (a *App) ListGeoSiteCategories(path string) ([]string, error) {
	return geodat.ListGeoSiteCategories(path)
}

// ListGeoIPCategories returns all category names in a geoip file
func (a *App) ListGeoIPCategories(path string) ([]string, error) {
	return geodat.ListGeoIPCategories(path)
}

// LoadDomains loads domains from specified categories
func (a *App) LoadDomains(path string, categories []string) ([]geodat.Entry, error) {
	cats, err := geodat.LoadDomainsFromCategories(path, categories)
	if err != nil {
		return nil, err
	}

	return cats, nil
}

// LoadIPs loads IPs from specified categories
func (a *App) LoadIPs(path string, categories []string) ([]geodat.Entry, error) {
	cats, err := geodat.LoadIpsFromCategories(path, categories)

	if err != nil {
		return nil, err
	}

	return cats, nil
}

func (a *App) SearchGeoSite(path string, query string, opts geodat.SearchOptions) ([]geodat.SearchResult, error) {
	return geodat.SearchGeoSite(path, query, opts)
}

func (a *App) SearchGeoIP(path string, query string, opts geodat.SearchOptions) ([]geodat.SearchResult, error) {
	return geodat.SearchGeoIP(path, query, opts)
}
