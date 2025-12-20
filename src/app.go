package main

import (
	"context"

	"github.com/daniellavrushin/geodatexplorer/geodat"
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

// Exposed to frontend
func (a *App) LoadDomains(path string, categories []string) ([]string, error) {
	return geodat.LoadDomainsFromCategories(path, categories)
}

func (a *App) LoadIPs(path string, categories []string) ([]string, error) {
	return geodat.LoadIpsFromCategories(path, categories)
}
