<script>
  import { fade } from 'svelte/transition'
  import { createEventDispatcher } from 'svelte'
  const dispatch = createEventDispatcher()

  export let tabs
  export let activeTab
  export let variants = ''

  $: dispatch('switch', activeTab)
</script>

{#if tabs.length > 1}
  <div class="tabs {variants}" in:fade={{ duration: 200 }}>
    <ul xyz="fade stagger">
      {#each tabs as tab}
        <li class="xyz-in" class:is-active={activeTab === tab}>
          <button
            on:click={() => (activeTab = tab)}
            class:text-primored={tab.highlighted}
            id={tab.id ? `tab-${tab.id}` : null}
          >
            {#if tab.icon}<i class="fas fa-{tab.icon}" />{/if}
            {typeof tab === 'string' ? tab : tab.label}
          </button>
        </li>
      {/each}
    </ul>
  </div>
{/if}

<link
  rel="stylesheet"
  href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css"
  integrity="sha512-1ycn6IcaQQ40/MKBW2W4Rhis/DbILU74C1vSrLJxCq57o941Ym01SwNsOMqvEBFlcgUa6xLiPY/NS5R+E6ztJQ=="
  crossorigin="anonymous"
  referrerpolicy="no-referrer"
/>

<style lang="postcss">
  .tabs {
    color: var(--color-gray-3);

    .tabs.secondary {
      height: 35px;

      ul {
        display: flex;
        justify-content: space-around;

        li {
          flex: 1;
          border-color: transparent;
          font-size: var(--font-size-1);
          font-weight: 700;
          border-bottom: 2px solid transparent;

          &.is-active {
            background: var(--primo-color-codeblack);
            color: var(--primo-color-white);
            border-color: var(--primo-color-codeblack);
          }

          button {
            width: 100%;
            text-align: center;
            padding: 0.5rem 0;
            outline: 0;
            font-size: var(--font-size-1);
            font-weight: 700;
          }
        }
      }
    }

    &:not(.secondary) {
      min-height: 2.5rem;
      border: 1px solid var(--color-gray-8);
      margin-bottom: 0.25rem;

      ul {
        display: flex;
        justify-content: space-around;

        li {
          flex: 1;
          border-bottom: 2px solid transparent;
          &.is-active {
            border-color: var(--primo-color-primored);
          }

          button {
            display: block;
            width: 100%;
            text-align: center;
            padding: 0.5rem 0;
            outline: 0;

            i {
              margin-right: 0.5rem;
            }
          }
        }
      }
    }
  }

  button {
    transition: var(--transition-colors);
  }
</style>
