package internal

import (
	"sort"

	"gopkg.in/yaml.v3"
)

// orderedMap emits as a YAML mapping with keys in a caller-specified order.
// Keys are walked in `keys` order; any value not present is skipped, and any
// key in `values` that isn't listed in `keys` is appended at the end in
// alphabetical order so output stays deterministic.
//
// Without this, Go's yaml.v3 sorts map[string]interface{} keys alphabetically,
// which destroys the meaningful "field declaration order" we build for
// content and the canonical order for fields.yaml.
type orderedMap struct {
	keys   []string
	values map[string]interface{}
}

func (o *orderedMap) MarshalYAML() (interface{}, error) {
	node := &yaml.Node{Kind: yaml.MappingNode}

	seen := make(map[string]bool, len(o.keys))
	for _, k := range o.keys {
		if _, ok := o.values[k]; !ok {
			continue
		}
		if seen[k] {
			continue
		}
		seen[k] = true
		if err := appendKV(node, k, o.values[k]); err != nil {
			return nil, err
		}
	}

	leftover := make([]string, 0)
	for k := range o.values {
		if seen[k] {
			continue
		}
		leftover = append(leftover, k)
	}
	sort.Strings(leftover)
	for _, k := range leftover {
		if err := appendKV(node, k, o.values[k]); err != nil {
			return nil, err
		}
	}

	return node, nil
}

func appendKV(node *yaml.Node, key string, value interface{}) error {
	keyNode := &yaml.Node{Kind: yaml.ScalarNode, Value: key}
	valNode := &yaml.Node{}
	if err := valNode.Encode(value); err != nil {
		return err
	}
	node.Content = append(node.Content, keyNode, valNode)
	return nil
}

// FIELD_KEY_ORDER is the canonical key order for a single field map inside
// fields.yaml / page-type config.yaml. Mirrors what most users naturally
// write and matches the agent guidance in the generated AGENT.md.
var fieldKeyOrder = []string{"_id", "label", "name", "type", "subfields", "config"}

// orderedField wraps a field map with the canonical field key order.
func orderedField(field map[string]interface{}) *orderedMap {
	if subfields, ok := field["subfields"].([]map[string]interface{}); ok {
		// Recurse so nested subfields also emit in canonical order.
		ordered := make([]interface{}, 0, len(subfields))
		for _, sub := range subfields {
			ordered = append(ordered, orderedField(sub))
		}
		copy := cloneStringMap(field)
		copy["subfields"] = ordered
		return &orderedMap{keys: fieldKeyOrder, values: copy}
	}
	return &orderedMap{keys: fieldKeyOrder, values: field}
}

// orderedFields wraps a slice of fields, applying canonical key order to
// each one. Use this when emitting fields.yaml or page-type config.yaml.
func orderedFields(fields []map[string]interface{}) []interface{} {
	out := make([]interface{}, 0, len(fields))
	for _, f := range fields {
		out = append(out, orderedField(f))
	}
	return out
}

// orderedContent wraps a content map (section content or content.yaml) with
// keys in field-declaration order. `keyOrder` should be the field keys in
// declaration index order; any content key not in `keyOrder` falls through
// to alphabetical order at the end.
func orderedContent(content map[string]interface{}, keyOrder []string) *orderedMap {
	return &orderedMap{keys: keyOrder, values: content}
}

func cloneStringMap(m map[string]interface{}) map[string]interface{} {
	out := make(map[string]interface{}, len(m))
	for k, v := range m {
		out[k] = v
	}
	return out
}
