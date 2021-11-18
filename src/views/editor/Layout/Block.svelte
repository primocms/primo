<script>
  import { createEventDispatcher, onDestroy } from 'svelte';
  import { fade } from 'svelte/transition';
  const dispatch = createEventDispatcher();

  import { createUniqueID, move } from '../../../utilities';
  import OptionsButtons from './OptionsButtons.svelte';
  import ContentNode from './ContentNode.svelte';
  import ComponentNode from './ComponentNode.svelte';
  import BlockButtons from './BlockButtons.svelte';

  import { focusedNode } from '../../../stores/app';
  import { onMobile, saved } from '../../../stores/app/misc';
  import modal from '../../../stores/app/modal';
  import { id, sections } from '../../../stores/app/activePage';
  import { pages } from '../../../stores/actions';

  export let block
  export let i

  let node

  function hasOptionsAbove(rowIndex, rows) {
    const rowAbove = rows[rowIndex - 1];
    if (rowAbove && rowAbove.type === 'options') {
      return true;
    } else return false;
  }

  function hasOptionsBelow(rowIndex, rows) {
    const rowBelow = rows[rowIndex + 1];
    if (rowBelow && rowBelow.type === 'options') {
      return true;
    } else return false;
  }

  function checkIfOnlyChild() {
    return $sections.length <= 1;
  }

  function deleteRow() {
    const onlyChild = $sections.length <= 1;
    if (onlyChild) {
      updateBlock(OptionsRow());
    } else {
      updateBlock(null);
    }
  }

  function updateBlock(newBlock) {
    updateSections(
      $sections
        .map((exitingBlock) =>
          exitingBlock.id === block.id ? newBlock : exitingBlock
        )
        .filter(Boolean)
    );
  }

  function updateSections(newSections) {
    pages.update($id, (page) => ({
      ...page,
      sections: newSections,
    }));
    $saved = false;
  }

  // Constructors
  function ContentRow() {
    return {
      id: createUniqueID(),
      type: 'content',
      value: {
        html: '',
      },
    };
  }

  function OptionsRow() {
    return {
      id: createUniqueID(),
      type: 'options',
    };
  }

  function insertOptionsRow(i, position) {
    hovering = false;
    if (position === 'above') {
      updateSections([
        ...$sections.slice(0, i),
        OptionsRow(),
        ...$sections.slice(i),
      ]);
    } else {
      updateSections([
        ...$sections.slice(0, i + 1),
        OptionsRow(),
        ...$sections.slice(i + 1),
      ]);
    }
  }

  function moveBlock(i, direction) {
    if (direction === 'up') {
      updateSections(move($sections, i, i - 1));
    } else {
      updateSections(move($sections, i, i + 1));
    }
  }

  async function selectOption(option, payload = null) {
    if (option === 'component') {
      updateBlock(payload);
    } else if (option === 'content') {
      updateBlock(ContentRow());
    } else {
      console.error('No option set for ', option);
    }
  }

  function editComponent() {
    modal.show('COMPONENT_EDITOR', {
      component: block,
      header: {
        title: 'Edit Component',
        icon: 'fas fa-code',
        button: {
          icon: 'fas fa-check',
          label: 'Draft',
          onclick: (component) => {
            updateBlock(component);
            modal.hide();
          },
        },
      },
    });
  }

  let buttons;
  let hovering = false;
  $: if (!hovering && sticky) {
    sticky = false;
  }
  let sticky = false;
  let toolbarHeight = 0;

  let container
  let toolbar
  $: if (container && hovering) {
    toolbar = document.querySelector('#primo-toolbar');
    window.addEventListener('scroll', positionBlock);
    positionBlock();
  } else if (!hovering) {
    window.removeEventListener('scroll', positionBlock);
  }

  let mounted = false
  if (block.type === 'content') {
    // delay mount to line up with components
    setTimeout(() => {
      mounted = true
    }, 1000)
  } else if (block.type !== 'component') {
    mounted = true
  }

  async function positionBlock() {
    if (!node || !container || !hovering) return
    toolbarHeight = toolbar ? toolbar.clientHeight : 0;
    const { top } = node.getBoundingClientRect();
    const { top: parentTop, bottom: parentBottom } = container.getBoundingClientRect();
    const topButtons = node.querySelector('.top');

    const shouldSticky = top < toolbarHeight && hovering;
    const outOfView = parentBottom <= toolbarHeight;
    const belowToolbar = parentTop > toolbarHeight || (!hovering && sticky);

    if (shouldSticky) {
      // not yet sticky, top is above the toolbar
      stickyButtons(topButtons);
    } else if (belowToolbar || outOfView) {
      // currently sticky, top is below toolbar
      resetButtons(topButtons);
    }

    if (node.style.position === 'fixed') {
      sticky = true;
    } else {
      sticky = false;
    }

    function stickyButtons(node) {
      node.style.position = 'fixed';
      node.style.top = `${toolbarHeight}px`; // toolbarHeight missing 8px for some reason
    }

    function resetButtons(node) {
      node.style.position = 'absolute';
      node.style.top = '0px';
      sticky = false;
    }
  }
  
</script>

<div
  bind:this={node}
  in:fade={{duration:100}}
  class:visible={mounted}
  class="primo-section has-{block.type}"
  id="{block.id}"
  on:mouseenter={() => (hovering = true)}
  on:mouseleave={() => (hovering = false)}
>
  <div bind:this={container} class="block-buttons-container" class:visible={(hovering || $onMobile) && block.type !== 'options'}>
    <BlockButtons
      {i}
      editable={block.type === 'component'}
      bind:node={buttons}
      on:delete={() => {
        deleteRow();
        dispatch('contentChanged');
      }}
      on:edit={editComponent}
      optionsAbove={hasOptionsAbove(i, $sections)}
      optionsBelow={hasOptionsBelow(i, $sections)}
      on:moveUp={() => {
        moveBlock(i, 'up');
        dispatch('contentChanged');
      }}
      on:moveDown={() => {
        moveBlock(i, 'down');
        dispatch('contentChanged');
      }}
      on:addOptionsAbove={() => {
        insertOptionsRow(i, 'above');
        dispatch('contentChanged');
      }}
      on:addOptionsBelow={() => {
        insertOptionsRow(i, 'below');
        dispatch('contentChanged');
      }}
    />
  </div>
  {#if block.type === 'component'}
    <ComponentNode {block} {node} on:mount={() => {mounted = true; dispatch('mount')}} />
  {:else if block.type === 'content'}
    <ContentNode
      {block}
      on:save
      on:focus={({ detail: selection }) => {
        focusedNode.setSelection({ id: block.id, position: i, selection });
      }}
      on:debounce={() => ($saved = false)}
      on:change={({ detail: html }) => {
        updateBlock({ ...block, value: { html } });
        dispatch('contentChanged');
      }}
      on:selectionChange={({ detail: selection }) => {
        focusedNode.setSelection({ id: block.id, position: i, selection });
      }}
      on:delete={deleteRow}
    />
  {:else if block.type === 'options'}
    <OptionsButtons
      deletable={!checkIfOnlyChild(block.id)}
      on:mount
      on:select={({ detail: component }) => {
        selectOption('component', component);
      }}
      on:convert={({ detail: type }) => selectOption(type)}
      on:remove={deleteRow}
    />
  {/if}
</div>

<style lang="postcss">
  .primo-section {
    position: relative;
  }
  .component {
    position: relative;
    outline: 5px solid transparent;
    outline-offset: -5px;
    transition: outline-color 0.2s;
    outline-color: transparent;
    width: 100%;
    min-height: 2rem;
  }
  .block-buttons-container {
    z-index: 999;
    opacity: 0;
    transition: 0.1s opacity;
    pointer-events: none;

    &.visible {
      opacity: 1;

      :global(button) {
        pointer-events: all;
      }
    }
  }
</style>
