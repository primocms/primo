package internal

import (
	"testing"

	_ "github.com/primocms/primo/migrations"
)

// TestCopyIfChangedSkipsIdenticalBytes verifies the core incremental-generate
// behavior: a copy whose destination already holds identical bytes is skipped
// (the destination file is left untouched), while diverging bytes trigger a
// real copy.
func TestCopyIfChangedSkipsIdenticalBytes(t *testing.T) {
	app := newImportTestApp(t)
	defer app.ResetBootstrapState()

	system, err := app.NewFilesystem()
	if err != nil {
		t.Fatalf("open filesystem: %v", err)
	}
	defer system.Close()

	srcKey := "test/source/file.txt"
	dstKey := "test/dest/file.txt"

	if err := system.Upload([]byte("hello world"), srcKey); err != nil {
		t.Fatalf("seed source: %v", err)
	}

	// First copy: destination does not exist yet, so it must be written.
	if err := copyIfChanged(system, srcKey, dstKey); err != nil {
		t.Fatalf("initial copy: %v", err)
	}
	firstAttr, err := system.Attributes(dstKey)
	if err != nil {
		t.Fatalf("attributes after initial copy: %v", err)
	}

	// Second copy with identical source: destination should be left untouched,
	// so its ModTime must not advance.
	if err := copyIfChanged(system, srcKey, dstKey); err != nil {
		t.Fatalf("no-op copy: %v", err)
	}
	if !destinationMatchesSource(system, srcKey, dstKey) {
		t.Fatalf("expected destination to match source after no-op copy")
	}
	secondAttr, err := system.Attributes(dstKey)
	if err != nil {
		t.Fatalf("attributes after no-op copy: %v", err)
	}
	if !secondAttr.ModTime.Equal(firstAttr.ModTime) {
		t.Fatalf("no-op copy rewrote destination: modtime moved %v -> %v", firstAttr.ModTime, secondAttr.ModTime)
	}

	// Diverge the source: the next copy must rewrite the destination.
	if err := system.Upload([]byte("hello mars"), srcKey); err != nil {
		t.Fatalf("update source: %v", err)
	}
	if destinationMatchesSource(system, srcKey, dstKey) {
		t.Fatalf("expected mismatch after source changed")
	}
	if err := copyIfChanged(system, srcKey, dstKey); err != nil {
		t.Fatalf("copy after change: %v", err)
	}
	reader, err := system.GetFile(dstKey)
	if err != nil {
		t.Fatalf("read destination after change: %v", err)
	}
	defer reader.Close()
	got := make([]byte, len("hello mars"))
	if _, err := reader.Read(got); err != nil {
		t.Fatalf("read bytes: %v", err)
	}
	if string(got) != "hello mars" {
		t.Fatalf("destination not updated: got %q", string(got))
	}
}
