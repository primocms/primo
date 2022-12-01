export default [
  {
    label: "{fieldID}",
    type: "text",
    apply: `{fieldID`,
    detail: "Output the value of a field",
  },
  {
    label: "{#if}",
    type: "text",
    apply: `{#if condition}  
  {:else}  
  {/if`,
    detail: "Conditionally render a block of content",
  },
  {
    label: "{#each}", type: "text", apply: `{#each items as item}
  <!-- repeating item -->
  {/each`, detail: "Loop over Repeater items"
  },
  {
    label: "{#await}", type: "text", apply: `{#await promise}
    <!-- promise is pending -->
    {:then value}
    <!-- promise was fulfilled -->
    {:catch error}
    {/await`,
    detail: "Show blocks depending on the states of a promise"
  },
  {
    label: "{#key}", type: "text", apply: `{#key value}
    <!-- re-rendered when 'value' changes -->
    {/key`, detail: "Re-render a block when a value changes"
  },
  {
    label: "{@html}", type: "text", apply: `{@html fieldID`, detail: "Render HTML from a Markdown field"
  },
  {
    label: "{@debug}", type: "text", apply: `{@debug variable`, detail: "Debug a variable value"
  },
  {
    label: "{@const}", type: "text", apply: `{@const variable`, detail: "Define a local constant"
  }
]