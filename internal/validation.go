package internal

import (
	_ "embed"
	"sync"

	"github.com/dop251/goja"
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/filesystem"
	"github.com/pocketbase/pocketbase/tools/types"
)

//go:embed common/index.cjs
var commonScript string

// A runtime is exclusively checked out for one validation. The model parsers
// are synchronous and do not retain record values between calls.
type validationRuntime struct {
	vm     *goja.Runtime
	models *goja.Object
}

func newValidationRuntime(prog *goja.Program) (*validationRuntime, error) {
	vm := goja.New()
	if _, err := vm.RunProgram(prog); err != nil {
		return nil, err
	}
	models := vm.GlobalObject().Get("exports").ToObject(vm).Get("models").ToObject(vm)
	return &validationRuntime{vm: vm, models: models}, nil
}

func RegisterValidation(pb *pocketbase.PocketBase) error {
	prog, err := goja.Compile("validation.js", "globalThis.exports = {};class File {};"+commonScript, true)
	if err != nil {
		return err
	}

	var runtimes sync.Pool

	pb.OnRecordValidate().BindFunc(func(event *core.RecordEvent) error {
		// Skip validation in dev mode for performance (import creates hundreds of records)
		if DevMode {
			return event.Next()
		}

		var err error

		// Reuse initialized models; sync.Pool never shares a runtime concurrently.
		runtime, _ := runtimes.Get().(*validationRuntime)
		if runtime == nil {
			runtime, err = newValidationRuntime(prog)
			if err != nil {
				return err
			}
		}
		vm, models := runtime.vm, runtime.models
		defer runtimes.Put(runtime)

		// Select model for validation
		collection := event.Record.Collection()
		model := models.Get(collection.Name)
		if model == nil {
			return event.Next()
		}
		validate, ok := goja.AssertFunction(model.ToObject(vm).Get("parse"))
		if !ok {
			return event.Next()
		}

		// Gather and parse values
		values := vm.NewObject()
		for _, field := range collection.Fields {
			name := field.GetName()
			value := event.Record.Get(name)

			// Match the JSON representation exposed by the records API. Goja
			// otherwise sees PocketBase timestamps as objects, not strings.
			if date, ok := value.(types.DateTime); ok {
				value = date.String()
			}

			if field.Type() == "json" {
				val := value.(types.JSONRaw)
				value, err = vm.RunString("(" + val.String() + ")")
				if err != nil {
					return err
				}
			}

			if field.Type() == "file" {
				// File fields are validated as strings of filenames
				switch val := value.(type) {
				case []*filesystem.File:
					names := make([]string, len(val))
					for index, file := range val {
						names[index] = file.Name
					}
					value = names
				case *filesystem.File:
					value = val.Name
				}
			}

			values.Set(name, value)
		}

		// Validate
		_, err = validate(goja.Undefined(), values)
		if err != nil {
			return err
		}

		return event.Next()
	})

	return nil
}
