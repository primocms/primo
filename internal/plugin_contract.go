package internal

import (
	"encoding/json"
	"fmt"
	"sync"

	"github.com/dop251/goja"
)

// formsManifestJSON is the authoritative plugins/forms/manifest.json. `go:embed`
// cannot reach outside the internal/ package directory, so main.go embeds it
// (main.go is a sibling of plugins/) and hands the bytes to RegisterForms at
// startup. This keeps a single copy of the file on disk — Go never keeps a
// hand-maintained duplicate of "what capabilities forms may use".
var formsManifestJSON []byte

const formsPluginID = "forms"

// formsCapabilityMethods names, for each capability the forms plugin may
// declare, the one representative method forms.go actually calls through it
// (DataAdapter.insert for storage, EmailAdapter.send for notifications — see
// src/lib/common/capabilities/data.ts and email.ts). It is intentionally
// small and plugin-specific rather than a general adapter registry: this is
// the first vertical, not marketplace machinery for eight capabilities.
var formsCapabilityMethods = map[string]string{
	"data":  "insert",
	"email": "send",
}

var (
	capabilityProgramOnce sync.Once
	capabilityProgram     *goja.Program
	capabilityProgramErr  error
)

// capabilityRuntimeProgram compiles the same bundled src/lib/common output
// RegisterValidation uses for record models (see validation.go's commonScript,
// embedded from internal/common/index.cjs). src/lib/common/index.ts now also
// re-exports src/lib/common/capabilities and src/lib/common/plugins, so the
// bundle carries PluginManifest and authorize_invocation as well. Reusing it
// here — rather than hand-porting the manifest schema and authorization rules
// to Go — is the "practical shared contract": the server enforces the actual
// TypeScript contract, so the two can't drift apart silently.
//
// Compiled once (goja.Program is immutable bytecode, safe to share); each
// call site still gets its own goja.Runtime, since a Runtime is not
// goroutine-safe.
func capabilityRuntimeProgram() (*goja.Program, error) {
	capabilityProgramOnce.Do(func() {
		capabilityProgram, capabilityProgramErr = goja.Compile(
			"capability-contract.js",
			"globalThis.exports = {};class File {};"+commonScript,
			true,
		)
	})
	return capabilityProgram, capabilityProgramErr
}

// PluginRequirement mirrors the long form of one `requires` entry
// (src/lib/common/plugins/manifest.ts's CapabilityRequirement).
type PluginRequirement struct {
	Capability string `json:"capability"`
	Optional   bool   `json:"optional"`
	Reason     string `json:"reason"`
}

// ParsedPluginManifest is the Go-side view of a manifest after it has been
// validated and normalized by the real PluginManifest zod schema.
type ParsedPluginManifest struct {
	ID       string              `json:"id"`
	Name     string              `json:"name"`
	Version  string              `json:"version"`
	Requires []PluginRequirement `json:"requires"`
}

func (m ParsedPluginManifest) requiredCapabilities() []string {
	var out []string
	for _, r := range m.Requires {
		if !r.Optional {
			out = append(out, r.Capability)
		}
	}
	return out
}

func (m ParsedPluginManifest) optionalCapabilities() []string {
	var out []string
	for _, r := range m.Requires {
		if r.Optional {
			out = append(out, r.Capability)
		}
	}
	return out
}

func (m ParsedPluginManifest) declares(capability string) bool {
	for _, r := range m.Requires {
		if r.Capability == capability {
			return true
		}
	}
	return false
}

// pluginContract holds a manifest that has passed the real TS schema,
// together with the goja runtime it was parsed in, so authorize() can call
// the real authorize_invocation against the same parsed value without
// re-parsing or re-marshalling it back into a Go type.
type pluginContract struct {
	vm       *goja.Runtime
	exports  *goja.Object
	manifest goja.Value
	Parsed   ParsedPluginManifest
}

// loadPluginContract validates raw manifest JSON against the actual
// PluginManifest zod schema (src/lib/common/plugins/manifest.ts) running
// inside goja. It is used at plugin install/uninstall time — an
// authenticated, infrequent, admin-only action — never on the anonymous
// submit or per-minute notification delivery hot paths. Those instead check
// the already-persisted, site-scoped grant (see pluginCapabilityGranted),
// which is fast, plain Go, and derived from a contract-validated manifest
// rather than a parallel hand-written one.
func loadPluginContract(raw []byte) (*pluginContract, error) {
	prog, err := capabilityRuntimeProgram()
	if err != nil {
		return nil, err
	}

	vm := goja.New()
	if _, err := vm.RunProgram(prog); err != nil {
		return nil, err
	}
	exportsObj := vm.GlobalObject().Get("exports").ToObject(vm)

	// Parse the manifest text as a JS value inside the VM (like
	// validation.go does for JSON record fields) rather than converting a Go
	// map via ToValue, so zod sees a real JS object with the prototype chain
	// it expects.
	manifestVal, err := vm.RunString("(" + string(raw) + ")")
	if err != nil {
		return nil, fmt.Errorf("manifest is not valid JSON: %w", err)
	}

	pluginManifestExport := exportsObj.Get("PluginManifest")
	if pluginManifestExport == nil || goja.IsUndefined(pluginManifestExport) {
		return nil, fmt.Errorf("capability contract bundle has no PluginManifest export (rebuild internal/common/index.cjs from src/lib/common with `vite --config common.config.js build`)")
	}
	parseFn, ok := goja.AssertFunction(pluginManifestExport.ToObject(vm).Get("parse"))
	if !ok {
		return nil, fmt.Errorf("capability contract bundle's PluginManifest.parse is not callable")
	}
	parsedVal, err := parseFn(goja.Undefined(), manifestVal)
	if err != nil {
		return nil, fmt.Errorf("manifest failed capability contract validation: %w", err)
	}

	blob, err := json.Marshal(parsedVal.Export())
	if err != nil {
		return nil, err
	}
	var parsed ParsedPluginManifest
	if err := json.Unmarshal(blob, &parsed); err != nil {
		return nil, err
	}

	return &pluginContract{vm: vm, exports: exportsObj, manifest: parsedVal, Parsed: parsed}, nil
}

// authorize runs the real authorize_invocation (src/lib/common/plugins/runtime.ts)
// against this manifest for a server-side call to primo.<capability>.<method>.
// It is a static, per-plugin check — "does the contract allow this
// capability/method combination at all" — independent of whether any
// particular site has installed the plugin or granted an optional capability.
func (c *pluginContract) authorize(capability, method string) error {
	authorizeExport := c.exports.Get("authorize_invocation")
	if authorizeExport == nil || goja.IsUndefined(authorizeExport) {
		return fmt.Errorf("capability contract bundle has no authorize_invocation export")
	}
	authFn, ok := goja.AssertFunction(authorizeExport)
	if !ok {
		return fmt.Errorf("capability contract bundle's authorize_invocation is not callable")
	}
	invocation := c.vm.NewObject()
	invocation.Set("capability", capability)
	invocation.Set("method", method)
	_, err := authFn(goja.Undefined(), c.manifest, invocation, c.vm.ToValue("server"))
	if err != nil {
		return fmt.Errorf("primo.%s.%s is not authorized by the plugin contract: %w", capability, method, err)
	}
	return nil
}

// pluginManifestJSONFor is the (currently single-plugin) registry of
// embedded manifests. Deliberately not a directory scan or general plugin
// registry — see PROMPT.md/README.md: forms is the first vertical, not a
// marketplace.
func pluginManifestJSONFor(pluginID string) ([]byte, bool) {
	if pluginID == formsPluginID {
		return formsManifestJSON, true
	}
	return nil, false
}

// currentlyDeclaredCapabilities is populated once at startup (see
// registerCurrentlyDeclaredCapabilities) from the actual embedded manifest,
// keyed by plugin ID. It is the runtime-enforcement half of "existing grants
// must not authorize capabilities the currently loaded manifest no longer
// declares": a persisted installation row can only have been written by a
// manifest that declared the capability *at the time it was granted*, but if
// the binary is later deployed with an upgraded manifest that drops a
// capability, old rows (including migration-backfilled ones) must stop
// authorizing it immediately, without a database migration or per-request
// re-parse of the manifest.
var currentlyDeclaredCapabilities = map[string]map[string]bool{}

// registerCurrentlyDeclaredCapabilities validates manifest against the real
// capability contract and caches the resulting declared-capability set for
// pluginID, for pluginCapabilityGranted to intersect persisted grants
// against. Called once per plugin at startup (RegisterForms), not per
// request: re-running the goja module on every anonymous submit or
// notification tick would be wasteful, and the manifest a running binary
// serves cannot change without a restart anyway.
func registerCurrentlyDeclaredCapabilities(pluginID string, manifest []byte) error {
	contract, err := loadPluginContract(manifest)
	if err != nil {
		return fmt.Errorf("plugin %q manifest failed capability contract validation: %w", pluginID, err)
	}
	declared := map[string]bool{}
	for _, capability := range contract.Parsed.requiredCapabilities() {
		declared[capability] = true
	}
	for _, capability := range contract.Parsed.optionalCapabilities() {
		declared[capability] = true
	}
	currentlyDeclaredCapabilities[pluginID] = declared
	return nil
}

// capabilityCurrentlyDeclared reports whether the manifest loaded at startup
// for pluginID still declares capability. A plugin ID with no cached entry
// (never registered) declares nothing, so it fails closed.
func capabilityCurrentlyDeclared(pluginID, capability string) bool {
	return currentlyDeclaredCapabilities[pluginID][capability]
}
