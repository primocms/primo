package internal

import (
	"sync"
	"testing"

	"github.com/dop251/goja"
)

func validationTestProgram(tb testing.TB) *goja.Program {
	tb.Helper()
	prog, err := goja.Compile("validation.js", "globalThis.exports = {};class File {};"+commonScript, true)
	if err != nil {
		tb.Fatal(err)
	}
	return prog
}

func parseTestEntry(runtime *validationRuntime, valid bool) error {
	parse, _ := goja.AssertFunction(runtime.models.Get("site_entries").ToObject(runtime.vm).Get("parse"))
	id := "entry"
	if !valid {
		id = ""
	}
	value := runtime.vm.ToValue(map[string]any{"id": id, "field": "field", "locale": "en", "index": 0, "value": "hello"})
	_, err := parse(goja.Undefined(), value)
	return err
}

func TestValidationRuntimeReuse(t *testing.T) {
	runtime, err := newValidationRuntime(validationTestProgram(t))
	if err != nil {
		t.Fatal(err)
	}
	for i := 0; i < 20; i++ {
		if err := parseTestEntry(runtime, true); err != nil {
			t.Fatal(err)
		}
		if err := parseTestEntry(runtime, false); err == nil {
			t.Fatal("invalid record accepted")
		}
	}
}

func BenchmarkValidationRuntime(b *testing.B) {
	prog := validationTestProgram(b)
	for _, reuse := range []bool{false, true} {
		name := "fresh"
		if reuse {
			name = "pooled"
		}
		b.Run(name, func(b *testing.B) {
			var pool sync.Pool
			b.ReportAllocs()
			for i := 0; i < b.N; i++ {
				var runtime *validationRuntime
				if reuse {
					runtime, _ = pool.Get().(*validationRuntime)
				}
				if runtime == nil {
					var err error
					runtime, err = newValidationRuntime(prog)
					if err != nil {
						b.Fatal(err)
					}
				}
				if err := parseTestEntry(runtime, true); err != nil {
					b.Fatal(err)
				}
				if reuse {
					pool.Put(runtime)
				}
			}
		})
	}
}

func TestValidationRuntimePoolConcurrent(t *testing.T) {
	prog := validationTestProgram(t)
	var pool sync.Pool
	for i := 0; i < 8; i++ {
		t.Run("worker", func(t *testing.T) {
			t.Parallel()
			for j := 0; j < 20; j++ {
				runtime, _ := pool.Get().(*validationRuntime)
				if runtime == nil {
					var err error
					runtime, err = newValidationRuntime(prog)
					if err != nil {
						t.Fatal(err)
					}
				}
				if err := parseTestEntry(runtime, true); err != nil {
					t.Fatal(err)
				}
				if err := parseTestEntry(runtime, false); err == nil {
					t.Fatal("invalid record accepted")
				}
				pool.Put(runtime)
			}
		})
	}
}
