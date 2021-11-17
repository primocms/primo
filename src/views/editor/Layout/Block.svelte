<script>
  import { createEventDispatcher, onMount } from 'svelte';
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
  import { id, content } from '../../../stores/app/activePage';
  import { pages } from '../../../stores/actions';

  export let block;
  export let i;

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
    return $content.length <= 1;
  }

  function deleteRow() {
    const onlyChild = $content.length <= 1;
    if (onlyChild) {
      updateBlock(OptionsRow());
    } else {
      updateBlock(null);
    }
  }

  function updateBlock(newBlock) {
    updateContent(
      $content
        .map((exitingBlock) =>
          exitingBlock.id === block.id ? newBlock : exitingBlock
        )
        .filter(Boolean)
    );
  }

  function updateContent(newContent) {
    pages.update($id, (page) => ({
      ...page,
      content: newContent,
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
      updateContent([
        ...$content.slice(0, i),
        OptionsRow(),
        ...$content.slice(i),
      ]);
    } else {
      updateContent([
        ...$content.slice(0, i + 1),
        OptionsRow(),
        ...$content.slice(i + 1),
      ]);
    }
  }

  function moveBlock(i, direction) {
    if (direction === 'up') {
      updateContent(move($content, i, i - 1));
    } else {
      updateContent(move($content, i, i + 1));
    }
  }

  async function selectOption(option, payload = null) {
    if (option === 'component') {
      updateBlock(payload);
    } else if (option === 'symbol') {
      modal.show('SYMBOL_LIBRARY', {
        button: {
          onclick: (component) => {
            updateBlock(component);
            modal.hide();
          },
        },
      });
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

  function blockContainer(container) {
    const toolbar = document.querySelector('#primo-toolbar');
    toolbarHeight = toolbar ? toolbar.clientHeight : 0;
    const node = container.children[0];
    window.addEventListener('scroll', positionBlock);
    positionBlock();

    function positionBlock() {
      const { top } = node.getBoundingClientRect();
      const { top: parentTop, bottom: parentBottom } =
        container.getBoundingClientRect();
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
    }

    function stickyButtons(node) {
      node.style.position = 'fixed';
      node.style.top = `${toolbarHeight}px`;
    }

    function resetButtons(node) {
      node.style.position = 'absolute';
      node.style.top = '0px';
      sticky = false;
    }

    return {
      destroy() {
        window.removeEventListener('scroll', positionBlock);
      },
    };
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
  <div class="block-buttons-container" class:visible={(hovering || $onMobile) && block.type !== 'options'} use:blockContainer>
    <BlockButtons
      {i}
      editable={block.type === 'component'}
      bind:node={buttons}
      on:delete={() => {
        deleteRow();
        dispatch('contentChanged');
      }}
      on:edit={editComponent}
      optionsAbove={hasOptionsAbove(i, $content)}
      optionsBelow={hasOptionsBelow(i, $content)}
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
    opacity: 0;
    transition: 0.2s opacity;

    &.visible {
      transition: 0.2s opacity;
      opacity: 1;
    }
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
    display: none;

    &.visible {
      display: block;
    }
  }
</style>
