<script lang="ts">

  export let label
  export let value
  export let disabled = false
  export let variants = ''
  export let options
  export let info = null
  export let size:'small'|'medium'|'large' = 'medium'

</script>

<label class="{variants} {size}">
  {#if label}
    <span class="mb-2 text-sm" title={info}>
      { label }
      {#if info}<i class="fas fa-info-circle text-gray-300 text-xs"></i>{/if}
    </span>
  {/if}
  
  <select
    bind:value
    {disabled}
    {...$$restProps}
    >
    {#each options as option}
      <option value={option.id}>{option.label}</option>
    {/each}
  </select>
</label>

<style>
  select {
    outline-color: rgb(248,68,73);
    @apply bg-gray-900 p-2 border-2 border-gray-200;
  }

  label {
    @apply flex flex-col font-medium;
  }
  
  label.small {
    @apply text-lg;
  }
  label.small span {
    @apply mb-1 text-xs;
  }
  label.small select {
    @apply px-2 py-1;
  }

  label.medium {
    @apply text-xl;
  }
  label.medium span {
    @apply mb-2 text-sm;
  }
  label.medium select {
    @apply px-2;
  }
</style>