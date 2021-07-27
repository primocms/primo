<script>
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher();

  import TextInput from '../components/inputs/TextInput.svelte';

  export let field = {
    value: {
      label: '',
      url: '',
      active: false,
    },
  };

  $: if (typeof field.value === 'string' || !field.value) {
    field.value = {
      label: '',
      url: '',
      active: false,
    };
  } else if (field.value.title && !field.value.label) {
    // Fix old values using `title` instead of `label`
    field.value = {
      ...field.value,
      label: field.value.title,
    };
  }

</script>

<div class="link">
  <span>{field.label}</span>
  <div class="inputs">
    <TextInput
      on:input
      bind:value={field.value.label}
      id="page-label"
      label="Label"
      placeholder="About Us" />
    <TextInput
      on:input
      bind:value={field.value.url}
      label="URL"
      type="url"
      placeholder="about-us" />
  </div>
</div>
<slot />

<style lang="postcss">
  .link {
    display: flex;
    flex-direction: column;

    span {
      font-size: var(--font-size-1);
      font-weight: 600;
    }

    .inputs {
      display: flex;
      flex-direction: column;
      width: 100%;
      --TextInput-mt: 0.5rem;
    }
  }

</style>
