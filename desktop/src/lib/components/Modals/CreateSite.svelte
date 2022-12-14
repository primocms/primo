<script>
  import {getContext} from 'svelte'
  import {find as _find} from 'lodash-es'
  import SiteName from './CreateSite/SiteName.svelte'
  import SiteDuplication from './CreateSite/SiteDuplication.svelte'
  import SiteThemes from './CreateSite/SiteThemes.svelte'
  
  const track = getContext('track')

  export let onSuccess = (data) => {}
  let loading

  let siteData = {}
  function save_site_detail(args) {
    siteData = {
      ...siteData,
      ...args
    }
  }

  async function createNewSite() {
    loading = true
    track('CREATE_SITE', {
      type: active_step
    })
    onSuccess(siteData)
  }

  let active_step = 'name'

</script>


<main class="primo-modal" class:wide={active_step === 'themes'}>
  {#if active_step === 'name'}
    <SiteName 
      on:next={({detail}) => active_step = detail}
      on:submit={({detail}) => save_site_detail(detail)}
    />
  {:else if active_step === 'duplicate'}
    <SiteDuplication 
      on:back={() => active_step = 'name'}
      on:submit={({detail}) => save_site_detail(detail)} 
      on:create={createNewSite}
    />
  {:else if active_step === 'themes'}
    <SiteThemes 
      on:back={() => active_step = 'name'}
      on:submit={({detail}) => save_site_detail(detail)} 
      on:create={createNewSite}
    />
  {/if}
</main>


<style lang="postcss">
  .primo-modal {
    transition: max-width 0.5s;
    max-width: var(--primo-max-width-1);

    form {
      .name-url {
        margin-bottom: 1.5rem;
      }

      .submit {
        --color-link: var(--color-primored);
      }
    }

    &.wide {
      max-width: var(--primo-max-width-2);
    }
  }
  .primo-heading-lg {
    display: flex;
  }

  .creating-site {
    display: flex;
    align-items: center;

    & > * {
      margin: 0 1rem;
    }
  }

  .info {
      position: relative;
      padding-left: 0.5rem;

      svg {
        height: 0.75rem;
        width: 0.75rem;
      }

      svg:hover + span {
        opacity: 1;
      }
      span {
        font-size: 0.75rem;
        font-weight: 500;
        line-height: 1.5;
        position: absolute;
        background: var(--color-gray-8);
        padding: 1rem;
        width: 13rem;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.1s;
        z-index: 99;
        top: 17px;
      }
  }
</style>
