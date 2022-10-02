<script>
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher();

  export let field;

  function toggleSwitch() {
    field.value = !field.value;
    dispatch('input');
  }

</script>

<div class="label-container">
  <label for={field.key}>
    <span class="switch-label" for={field.key}>{field.label}</span>
    <div class="switch-container">
      <input type="checkbox" id={field.key} on:input={toggleSwitch} checked={field.value} />
      <span />
    </div>
  </label>
</div>

<style lang="postcss">
  .label-container {
    width: 100%;

    label {
      display: inline-block;

      .switch-label {
        font-weight: 600;
        margin-right: 1rem;
      }

      .switch-container {
        position: relative;
        display: inline-block;
        width: 3.5rem;
        vertical-align: middle;
        user-select: none;
        transition: transform 0.1s;

        input {
          color: var(--primo-color-brand);
          background: var(--primo-color-white);
          outline: 0;
          position: absolute;
          top: -4px;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 2rem;
          height: 2rem;
          border-radius: 100%;
          appearance: none;
          cursor: pointer;
          left: 0;
          transition: transform 0.1s;

          &:after {
            content: '\d7';
          }

          &:checked {
            transform: translateX(24px);

            &:after {
              content: '\2713';
            }
          }
        }

        span {
          outline: 0;
          display: block;
          overflow: hidden;
          height: 1.5rem;
          border-radius: 1rem;
          background: var(--color-gray-7);
          cursor: pointer;
        }
      }
    }
  }

</style>
