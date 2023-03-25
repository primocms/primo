<script>
  import Icon from '@iconify/svelte'
  import { createEventDispatcher } from 'svelte'
  const dispatch = createEventDispatcher()
  export let field
  export let level

  $: options = field.options?.options

  function validateFieldKey(key) {
    // replace dash and space with underscore
    return key.replace(/-/g, '_').replace(/ /g, '_').toLowerCase()
  }

  function moveOption(indexOfItem, direction) {
    const item = options[indexOfItem]
    const withoutItem = options.filter((_, i) => i !== indexOfItem)
    if (direction === 'up') {
      field.options.options = [
        ...withoutItem.slice(0, indexOfItem - 1),
        item,
        ...withoutItem.slice(indexOfItem - 1),
      ]
    } else if (direction === 'down') {
      field.options.options = [
        ...withoutItem.slice(0, indexOfItem + 1),
        item,
        ...withoutItem.slice(indexOfItem + 1),
      ]
    } else {
      console.error('Direction must be up or down')
    }
  }

  function removeOption(itemIndex) {
    field.options.options = field.options.options.filter(
      (_, i) => i !== itemIndex
    )
  }
</script>

<div class="main" style="margin-left: {1.5 + level}rem">
  {#if options}
    {#each options as option, i}
      <div class="select-field">
        <label>
          <span>Label</span>
          <input
            class="input label-input"
            type="text"
            bind:value={option.label}
            on:input
          />
        </label>
        <label>
          <span>Value</span>
          <input
            class="input key-input"
            type="text"
            bind:value={option.value}
            on:input={() => {
              option.value = validateFieldKey(option.value)
              dispatch('input')
            }}
          />
        </label>
        <div class="primo-buttons" id="repeater-{field.key}-{i}">
          <div class="item-options">
            {#if i !== 0}
              <button
                title="Move {field.label} up"
                on:click={() => moveOption(i, 'up')}
              >
                <Icon icon="fa-solid:arrow-up" />
              </button>
            {/if}
            {#if i !== options.length - 1}
              <button
                title="Move {field.label} down"
                on:click={() => moveOption(i, 'down')}
              >
                <Icon icon="fa-solid:arrow-down" />
              </button>
            {/if}
            <button
              title="Delete {field.label} item"
              on:click={() => removeOption(i)}
            >
              <Icon icon="fa-solid:trash" />
            </button>
          </div>
        </div>
      </div>
    {/each}
  {/if}
  <button
    class="field-button subfield-button"
    on:click={() => {
      if (!field.options?.options) {
        field.options = {
          options: [
            {
              label: '',
              value: '',
            },
          ],
        }
      } else {
        field.options.options = [
          ...field.options.options,
          {
            label: '',
            value: '',
          },
        ]
      }
      dispatch('input')
    }}><i class="fas fa-plus" />Add Option</button
  >
</div>

<style lang="postcss">
  .select-field {
    display: grid;
    grid-template-columns: 1fr 1fr auto;
    padding: 0.5rem;
    grid-gap: 1rem;
    gap: 1rem;

    label {
      display: grid;
      gap: 0.25rem;

      span {
        font-size: 0.75rem;
        font-weight: 700;
      }
    }
  }
  .field-button {
    width: 100%;
    background: var(--color-gray-7);
    color: var(--color-gray-3);
    padding: 8px 0;
    border-bottom-right-radius: var(--border-radius);
    border-bottom-left-radius: var(--border-radius);
    transition: var(--transition-colors);

    i {
      margin-right: 0.5rem;
    }
  }
  .field-button:hover {
    background: var(--color-gray-9);
  }
  .field-button.subfield-button {
    width: calc(100% - 1rem);
    border-radius: 2px;
    margin-top: 8px;
    margin-bottom: 8px;
    font-size: var(--font-size-2);
    background: var(--primo-color-codeblack);
    color: var(--color-gray-2);
    transition: var(--transition-colors);
    outline: 0;
  }
  .field-button.subfield-button:hover {
    background: var(--color-gray-9);
  }
  .field-button.subfield-button:focus {
    background: var(--color-gray-8);
  }
  .primo-buttons {
    display: flex;
    align-items: center;

    .item-options {
      font-size: 0.75rem;
    }
  }
  input {
    background: var(--color-gray-8);
    color: var(--color-gray-2);
    padding: 4px;
    border-radius: 2px;
    border: 0;
    padding: 0.5rem;
  }
  input:focus {
    outline: 0;
  }
</style>
