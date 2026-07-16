package main

import (
	"fmt"
	"log"

	"github.com/primocms/primo/internal"
	_ "github.com/primocms/primo/migrations"
	"github.com/pocketbase/pocketbase"
)

// Build info - set via ldflags
var BuildTime = "dev"

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
