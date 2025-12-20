package main

import (
	"context"

	"github.com/daniellavrushin/geodatexplorer/geodat"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

type App struct {
	ctx context.Context
}

func NewApp() *App {
	return &App{}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
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

func (a *App) SearchGeoSite(path string, query string) ([]geodat.SearchResult, error) {
	return geodat.SearchGeoSite(path, query)
}

func (a *App) SearchGeoIP(path string, query string) ([]geodat.SearchResult, error) {
	return geodat.SearchGeoIP(path, query)
}
