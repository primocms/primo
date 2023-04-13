<script lang="ts">
  import '@fontsource/fira-code/index.css'

  import { createEventDispatcher, onMount } from 'svelte'
  import Editor from './views/editor/Editor.svelte'
  import Modal from './views/modal/ModalContainer.svelte'
  import modal from './stores/app/modal'
  import * as modals from './views/modal'

  const dispatch = createEventDispatcher()

  import { userRole } from './stores/app'
  import { saving as savingStore, showKeyHint } from './stores/app/misc'
  import { Site } from './const'

  import { options as options_store, saved } from './stores/app/misc'
  import { set_timeline } from './stores/data'
  import { site as draft } from './stores/data/draft'
  import { hydrate_active_data, updatePreview } from './stores/actions'
  import en from './languages/en.json'
  import es from './languages/es.json'

  import type { Site as SiteType, Page as PageType } from './const'

  import { init, addMessages } from 'svelte-i18n'

  export let data: SiteType = Site()
  // export let page_id = 'index'
  export let role: 'developer' | 'content' = 'developer'
  export let saving: boolean = false
  export let language: string = 'en'
  export let options: object = {}

  options_store.update((s) => ({ ...s, ...options }))

  $: $savingStore = saving
  $: $userRole = role

  addMessages('en', en)
  addMessages('es', es)

  init({
    fallbackLocale: 'en',
    initialLocale: language,
  })

  hydrate_active_data(data)
  set_timeline(data)

  function saveSite(): void {
    dispatch('save', $draft)
  }

  $: activeModal = getActiveModal($modal.type)
  function getActiveModal(modalType) {
    return modalType
      ? {
          SITE_PAGES: modals.SitePages,
          COMPONENT_EDITOR: modals.ComponentEditor,
          PAGE_EDITOR: modals.PageEditor,
          SITE_EDITOR: modals.SiteEditor,
        }[modalType] || $modal.component
      : null
  }

  // onMount(() => {
  //   Mousetrap.bind('mod', () => ($showKeyHint = true), 'keydown')
  //   Mousetrap.bind('mod', () => ($showKeyHint = false), 'keyup')
  // })
</script>

<Editor on:save={saveSite} />

<Modal visible={!!activeModal}>
  <svelte:component
    this={activeModal}
    {...$modal.componentProps}
    on:save={saveSite}
  />
</Modal>

<!-- Prevent leaving Primo without saving -->
<svelte:window
  on:beforeunload={(e) => {
    if ($saved || import.meta.env.DEV) delete e['returnValue']
    else e.returnValue = ''
  }}
/>

<svelte:head>
  <link
    rel="stylesheet"
    href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css"
    integrity="sha512-1ycn6IcaQQ40/MKBW2W4Rhis/DbILU74C1vSrLJxCq57o941Ym01SwNsOMqvEBFlcgUa6xLiPY/NS5R+E6ztJQ=="
    crossorigin="anonymous"
    referrerpolicy="no-referrer"
  />
</svelte:head>

<style lang="postcss">
  :global(#page, #primo-toolbar, #primo-modal) {
    --primo-color-brand-dark: #097548;
    --primo-color-white: white;
    --primo-color-codeblack: rgb(30, 30, 30);
    --primo-color-codeblack-opaque: rgba(30, 30, 30, 0.9);

    --primo-border-radius: 4px;

    --primo-color-black: rgb(17, 17, 17);
    --primo-color-black-opaque: rgba(17, 17, 17, 0.95);

    --color-gray-1: rgb(245, 245, 245);
    --color-gray-2: rgb(229, 229, 229);
    --color-gray-3: rgb(212, 212, 212);
    --color-gray-4: rgb(156, 163, 175);
    --color-gray-5: rgb(115, 115, 115);
    --color-gray-6: rgb(82, 82, 82);
    --color-gray-7: rgb(64, 64, 64);
    --color-gray-8: rgb(38, 38, 38);
    --color-gray-9: rgb(23, 23, 23);

    --font-size-1: 0.75rem;
    --font-size-2: 0.875rem;
    --font-size-3: 1.125rem;
    --font-size-4: 1.25rem;

    --input-background: #2a2b2d;
    --input-border: 1px solid #222;
    --input-border-radius: 4px;

    --label-font-size: 1rem;
    --label-font-weight: 700;

    --title-font-size: 0.875rem;
    --title-font-weight: 700;

    --button-color: #fafafa;
    --primo-button-background: #37383a;
    --button-hover-color: #7d8082;

    box-shadow: 0 0 #0000 0 0 #0000, 0 1px 2px 0 rgba(0, 0, 0, 0.05);
    --box-shadow-xl: 0 0 #0000, 0 0 #0000, 0 20px 25px -5px rgba(0, 0, 0, 0.1),
      0 10px 10px -5px rgba(0, 0, 0, 0.04);

    --transition-colors: background-color 0.1s, border-color 0.1s, color 0.1s,
      fill 0.1s, stroke 0.1s;

    --padding-container: 15px;
    --max-width-container: 1900px;

    --ring: 0px 0px 0px 2px var(--primo-color-brand);
    --primo-ring-primogreen: 0px 0px 0px 2px var(--primo-color-brand, #35d994);
    --primo-ring-primogreen-thin: 0px 0px 0px 1px
      var(--primo-color-brand, #35d994);
    --primo-ring-primogreen-thick: 0px 0px 0px 3px
      var(--primo-color-brand, #35d994);
  }
</style>
