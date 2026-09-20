package main

import (
	_ "embed"
	"fmt"
	"log"

	"github.com/pocketbase/pocketbase"
	"github.com/primocms/primo/internal"
	_ "github.com/primocms/primo/migrations"
)

// Build info - set via ldflags
var BuildTime = "dev"

// formsPluginManifest is plugins/forms/manifest.json, the single source of
// truth for which capabilities the forms plugin may request. Embedded here
// (rather than in internal/) because go:embed patterns can't cross out of
// the containing package's directory, and plugins/ lives at the repo root
// alongside main.go.
//
//go:embed plugins/forms/manifest.json
var formsPluginManifest []byte

func main() {
	fmt.Printf("[primo build: %s]\n", BuildTime)
	pb := pocketbase.New()

	if err := setup(pb); err != nil {
		log.Fatal(err)
	}

	if err := pb.Start(); err != nil {
		log.Fatal(err)
	}
}

func setup(pb *pocketbase.PocketBase) error {
	if err := internal.RegisterForms(pb, formsPluginManifest); err != nil {
		return err
	}

	if err := internal.RegisterCORS(pb); err != nil {
		return err
	}

	if err := internal.RegisterVersion(pb); err != nil {
		return err
	}

	if err := internal.RegisterValidation(pb); err != nil {
		return err
	}

	if err := internal.RegisterEmailInvitation(pb); err != nil {
		return err
	}

	if err := internal.RegisterPasswordLinkEndpoint(pb); err != nil {
		return err
	}

	if err := internal.RegisterInfoEndpoint(pb); err != nil {
		return err
	}

	if err := internal.RegisterGenerateEndpoint(pb); err != nil {
		return err
	}

	if err := internal.RegisterAdminApp(pb); err != nil {
		return err
	}

	if err := internal.ServeSites(pb); err != nil {
		return err
	}

	if err := internal.RegisterUsageStats(pb); err != nil {
		return err
	}

	if err := internal.RegisterUserActivity(pb); err != nil {
		return err
	}

	if err := internal.RegisterCloneSiteEndpoint(pb); err != nil {
		return err
	}

	if err := internal.RegisterExportEndpoint(pb); err != nil {
		return err
	}

	if err := internal.RegisterLibraryExportEndpoint(pb); err != nil {
		return err
	}

	if err := internal.RegisterImportEndpoint(pb); err != nil {
		return err
	}

	if err := internal.RegisterLibraryImportEndpoint(pb); err != nil {
		return err
	}

	if err := internal.RegisterBootstrapEndpoint(pb); err != nil {
		return err
	}

	if err := internal.RegisterDomainEndpoints(pb); err != nil {
		return err
	}

	if err := internal.RegisterSiteLimit(pb); err != nil {
		return err
	}

	if err := internal.RegisterEditorLimit(pb); err != nil {
		return err
	}

	if err := internal.RegisterDevAuthEndpoint(pb); err != nil {
		return err
	}

	if err := internal.RegisterDevMode(pb); err != nil {
		return err
	}

	return nil
}
