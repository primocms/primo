package main

import (
	"log"

	"github.com/palacms/palacms/internal"
	_ "github.com/palacms/palacms/migrations"
	"github.com/pocketbase/pocketbase"
)

func main() {
	pb := pocketbase.New()

	if err := setup(pb); err != nil {
		log.Fatal(err)
	}

	if err := pb.Start(); err != nil {
		log.Fatal(err)
	}
}

func setup(pb *pocketbase.PocketBase) error {
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

	if err := internal.RegisterImportEndpoint(pb); err != nil {
		return err
	}

	if err := internal.RegisterBootstrapEndpoint(pb); err != nil {
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
