package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/primocms/primo/hosting"
)

func main() {
	c, err := hosting.ConfigFromEnv()
	if err != nil {
		slog.Error("hosting configuration invalid", "error", err)
		os.Exit(1)
	}
	store, err := hosting.OpenStore(c.Database, c.Key)
	if err != nil {
		slog.Error("unable to open hosting database")
		os.Exit(1)
	}
	defer store.Close()
	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer cancel()
	provider := hosting.NewFlyProvisioner(c)
	s := &hosting.Service{Config: c, Store: store, Provisioner: provider, Mailer: hosting.ResendMailer{Token: c.ResendToken, From: c.FromEmail, Endpoint: "https://api.resend.com", Client: &http.Client{Timeout: 30 * time.Second}}}
	s.Suspender = provider
	s.Backups = &hosting.BackupManager{Config: c, Store: store, Client: &http.Client{Timeout: 10 * time.Minute}}
	backupDone := make(chan struct{})
	go func() {
		defer close(backupDone)
		ticker := time.NewTicker(time.Hour)
		defer ticker.Stop()
		for {
			if err := s.Backups.Run(ctx); err != nil {
				slog.Error("hosted backups need attention", "error", err)
				mailCtx, stop := context.WithTimeout(ctx, 30*time.Second)
				s.Mailer.Send(mailCtx, c.AlertEmail, "Primo backups need attention", "A hosted backup could not complete. Review the control-plane backup logs and private backup status. Existing data and previously stored archives are retained.", "primo-backup-alert-"+time.Now().UTC().Format("2006-01-02"))
				stop()
			}
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
			}
		}
	}()
	owner := time.Now().UTC().Format(time.RFC3339Nano)
	s.Credentials = &hosting.CredentialManager{Config: c, Store: store, Provider: provider, Mailer: s.Mailer}
	credentialsDone := make(chan struct{})
	go func() {
		defer close(credentialsDone)
		ticker := time.NewTicker(time.Minute)
		defer ticker.Stop()
		for {
			if err := s.MaintainCredentials(ctx, owner); err != nil {
				slog.Error("domain credential maintenance unavailable")
			}
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
			}
		}
	}()
	done := make(chan struct{})
	go func() {
		defer close(done)
		defer store.Release(owner)
		ticker := time.NewTicker(5 * time.Second)
		defer ticker.Stop()
		for {
			if err := s.Tick(ctx, owner); err != nil {
				slog.Error("hosting worker unavailable")
			}
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
			}
		}
	}()
	server := &http.Server{Addr: ":8080", Handler: s.Handler(), ReadHeaderTimeout: 10 * time.Second, ReadTimeout: 15 * time.Second, WriteTimeout: 40 * time.Second, IdleTimeout: 60 * time.Second}
	go func() {
		<-ctx.Done()
		shutdown, stop := context.WithTimeout(context.Background(), 45*time.Second)
		defer stop()
		server.Shutdown(shutdown)
	}()
	slog.Info("hosting service started")
	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		slog.Error("hosting server stopped")
		cancel()
	}
	<-done
	<-credentialsDone
	<-backupDone
}
