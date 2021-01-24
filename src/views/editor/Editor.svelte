<script lang="ts">
  import Mousetrap from 'mousetrap'
  import _ from 'lodash'
  import { onMount, createEventDispatcher, getContext } from 'svelte'
  import {writable} from 'svelte/store'

  const dispatch = createEventDispatcher()
  
  import Toolbar from './Toolbar.svelte'
  import ToolbarButton from './ToolbarButton.svelte'
  import Doc from './Doc.svelte'

  // import site from '../../stores/data/site'
  import {focusedNode,switchEnabled} from '../../stores/app'
  import {undone} from '../../stores/data/draft'
  import {saving,unsaved} from '../../stores/app/misc'
  import modal from '../../stores/app/modal'
  import {undoSiteChange,redoSiteChange} from '../../stores/actions'
  import {id, content} from '../../stores/app/activePage'
  import {makeDeveloperButtons, makeEditorButtons, makeEditorialButtons} from '../../constants'
  import type {Button,ButtonGroup,Component} from './Layout/LayoutTypes'

  let unlockingPage:boolean = false

  let updatingDatabase:boolean = false

  // setup key-bindings
  Mousetrap.bind(['mod+s'], (e) => {
    e.preventDefault()
    savePage()
  })

  const editorialButtons:Array<ButtonGroup> = makeEditorialButtons();
  const editorButtons = makeEditorButtons({handleClose: addComponentToPage});
  const developerButtons = makeDeveloperButtons({handleClose: addComponentToPage});

  function addComponentToPage(component:Component): void {
    saveRow(component)
    modal.hide()
  }

  function savePage(): void {
    dispatch('save')
  }

  let toolbarButtons:Array<ButtonGroup>
  $: toolbarButtons = $switchEnabled ? developerButtons : editorButtons

  // Show 'are you sure you want to leave prompt' when closing window 
  $: if ($unsaved && window.location.hostname !== 'localhost') {
    window.onbeforeunload = function(e){
      e.returnValue = '';
    };
  } else {
    window.onbeforeunload = function(e){
      delete e['returnValue'];
    };
  }

  function saveRow(row) {
    if (getRow(row.id)) {
      updateRow(row.id, row);
    } else {
      insertComponent(row);
    }
  }

  function getRow(id) {
    const rows = _.flattenDeep(
      $content.map((section) => section.columns.map((column) => column.rows))
    );
    return _.find(rows, ["id", id]);
  }

  function updateRow(rowId, updatedRow) {
    $content = $content.map((section) => ({
      ...section,
      columns: section.columns.map((column) => ({
        ...column,
        rows: column.rows
          .map((existingRow) => {
            if (existingRow.id === rowId) {
              return updatedRow === null
                ? updatedRow
                : { ...existingRow, ...updatedRow }; // allow row to be removed
            } else return existingRow;
          })
          .filter((r) => r),
      })),
    }))
  }

  function insertComponent(component) {
    const focusedNodeId = $focusedNode.id;

    if (focusedNodeId) {
      // a content node is selected on the page
      $content = $content.map((section) => ({
        ...section,
        columns: section.columns.map((column) => ({
          ...column,
          rows: _.some(column.rows, ["id", focusedNodeId]) // this column contains the selected node
            ? positionComponent(column.rows, component) // place the component within
            : column.rows,
        })),
      }))
    } else if (content.length > 0) {
      const lastSection = $content.slice(-1)[0];
      const lastColumn = lastSection.columns.slice(-1)[0];
      $content = $content.map((section) =>
        section.id === lastSection.id
          ? {
              ...section,
              columns: section.columns.map((column) =>
                column.id === lastColumn.id
                  ? {
                      ...column,
                      rows: [...column.rows, component],
                    }
                  : column
              ),
            }
          : section
      )
    }

    function positionComponent(rows, newRow) {
      const selectedNodePosition = $focusedNode.position;
      const selectedNodeSelection = $focusedNode.selection;

      if (selectedNodePosition === 0) {
        // first row is selected
        if (selectedNodeSelection === 0) {
          // top of first row selected
          return [newRow, ...rows];
        } else {
          return [...rows.slice(0, 1), newRow, ...rows.slice(1)];
        }
      } else if (selectedNodePosition > 0) {
        // somewhere else in the list
        if (selectedNodeSelection === 0) {
          return [
            ...rows.slice(0, selectedNodePosition),
            newRow,
            ...rows.slice(selectedNodePosition),
          ];
        } else {
          return [
            ...rows.slice(0, selectedNodePosition + 1),
            newRow,
            ...rows.slice(selectedNodePosition + 1),
          ];
        }
      } else {
        console.error("Could not position new component");
      }
    }
  }

</script>

<Toolbar on:signOut buttons={toolbarButtons} let:showKeyHint={showKeyHint} on:toggleView={() => switchEnabled.set(!$switchEnabled)}>
  <ToolbarButton id="undo" title="Undo" icon="undo-alt" on:click={undoSiteChange} buttonStyles="mr-1 bg-gray-600" />
  {#if $undone.length > 0}
    <ToolbarButton id="redo" title="Redo" icon="redo-alt" on:click={redoSiteChange} buttonStyles="mr-1 bg-gray-600" />
  {/if}
  <ToolbarButton id="save" title="Save" icon="save" key="s" {showKeyHint} loading={$saving} on:click={savePage} disabled={!$unsaved} buttonStyles="mr-1 bg-gray-600" />
  {#if $switchEnabled}
    <ToolbarButton type="primo" title="Build" icon="fas fa-hammer" active={false} on:click={() => modal.show('BUILD')} disabled={updatingDatabase} variant="bg-gray-200 text-gray-900 hover:bg-gray-400" />
  {:else}
    <ToolbarButton type="primo" on:click={() => modal.show('BUILD')} disabled={updatingDatabase}>publish</ToolbarButton>
  {/if}
</Toolbar>
<Doc 
  bind:content={$content}
  on:contentChanged={() => {
    dispatch('change')
  }}
  on:componentEditClick={({detail:component}) => {
    modal.show('COMPONENT_EDITOR', { 
      component,
      header: {
        title: 'Edit Component',
        icon: 'fas fa-code',
        button: {
          label: 'Draft',
          icon: 'fas fa-check',
          onclick: (component) => {
            saveRow(component)
            modal.hide()
          }
        }
      }
    })
  }}
/>