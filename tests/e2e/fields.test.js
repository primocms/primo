import { test, expect } from '@playwright/test'

// TODO:
// - test from Symbol
// - test from mastered Section
// - test from master Section

// Adding top-level fields
// - add text field
// - add deep repeater (repeater field w/ nested group w/ nested repeater w/ text field)
// - add deep group (group field w/ nested repeater w/ nested group w/ text field)

// Adding child fields
// - add deeply nested text field to repeater
// - add deeply nested text field to group
// - "" w/ more section repeater containers than symbol repeater containers
// - "" w/ more symbol repeater containers than section repeater containers

// Adding relational fields
// - page field
// - site field
// - page list
// - page

// Modifying top-level fields
// - change repeater field to text field
// - change repeater field to group field
// - change group field to text field
// - change group field to repeater field

// Modifying child fields
// - change deeply nested repeater field to text field
// - change deeply nested repeater field to group field
// - change deeply nested group field to text field
// - change deeply nested group field to repeater field

// Assert:
// - changes reflected across symbol & siblings
// - undo, redo (x2), across multiple changes
