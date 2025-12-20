package main

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"
)

var rootCmd = &cobra.Command{
	Use:   "geodatexplorer",
	Short: "GeodatExplorer - A simple GUI Geo DAT files explorer",
	Long:  `GeodatExplorer is a simple GUI application for exploring Geo DAT files.`,
	RunE:  runGeodatExplorer,
}

func main() {

	if err := rootCmd.Execute(); err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}

}

func runGeodatExplorer(cmd *cobra.Command, args []string) error {
	fmt.Println("GeodatExplorer is starting...")
	// Here would be the code to initialize and run the GUI application.
	return nil
}
