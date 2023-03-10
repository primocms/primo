<script>
  import { cloneDeep as _cloneDeep } from 'lodash-es'
  import { onMount } from 'svelte'
  import { createUniqueID } from '$lib/editor/utilities'
  import Tabs from '$lib/ui/Tabs.svelte'
  import PrimaryButton from '$lib/ui/PrimaryButton.svelte'
  import CopyButton from '$lib/ui/CopyButton.svelte'
  import Hosting from '../Hosting.svelte'
  import * as supabaseDB from '../../../supabase/db'
  import { setCustomization } from '../../../actions'
  import config from '../../../stores/config'
  import ImageField from '../../../extensions/FieldTypes/ImageField.svelte'
  // import RepeaterField from '$lib/editor/field-types/RepeaterField.svelte'
  import Link from '$lib/editor/field-types/Link.svelte'
  import TextField from '$lib/editor/field-types/ContentField.svelte'

  const tabs = [
    {
      label: 'Hosting',
      icon: 'globe',
    },
    {
      label: 'Customize',
      icon: 'palette',
    },
  ]
  let activeTab = tabs[0]
</script>

<main>
  <Tabs {tabs} bind:activeTab />
  <div class="content-container">
    {#if activeTab.label === 'Hosting'}
      <h1 class="primo-heading-lg">
        Hosting <span
          >Connect to your favorite webhost to publish your primo sites to the
          internet</span
        >
      </h1>
      <Hosting />
    {:else if activeTab.label === 'Customize'}
      <h1 class="primo-heading-lg">Customize</h1>
      <div>
        <ImageField
          on:input={({ detail }) => setCustomization({ logo: detail.value })}
          field={{
            label: 'Logo',
            value: $config.customization.logo,
          }}
        />
        <br /><br />
        <!-- <RepeaterField
          field={{
            key: 'footer-links',
            label: 'Footer Links',
            fields: [
              {
                key: 'link',
                label: 'Link',
                type: 'link',
                value: {
                  label: '',
                  url: '',
                },
                fields: [],
              },
            ],
            value: $config.customization.links.map((link) => ({ link })),
          }}
          on:input={({ detail }) => {
            setCustomization({
              links: detail.value.map((subfield) => ({ ...subfield.link })),
            })
          }}
        /> -->
        <br /><br />
        <Link
          field={{
            key: 'docs',
            label: 'Documentation Link',
            value: $config.customization.docs,
          }}
          on:input={({ detail }) => {
            setCustomization({
              docs: detail.value,
            })
          }}
        />
        <br /><br />
        <TextField
          field={_cloneDeep({
            label: 'Brand Color',
            value: $config.customization.color,
          })}
          on:input={({ detail }) =>
            setCustomization({
              color: detail.value,
            })}
        />
      </div>
    {/if}
  </div>
</main>

<style lang="postcss">
  h1 {
    display: flex;
    flex-direction: column;
    line-height: 1.4;
    margin-bottom: 1rem;

    span {
      font-weight: 500;
      font-size: 0.75rem;
      color: var(--color-gray-4);
    }
  }
  button {
    font-size: 0.75rem;
    margin: 1rem 0;
    text-decoration: underline;
    color: var(--color-gray-4);
  }
  main {
    color: var(--color-gray-1);
    background: var(--color-gray-9);
    padding: 2rem;
    border: 2px solid var(--color-primored);
    border-radius: 0.25rem;
    width: 100vw;
    max-width: 600px;

    .content-container {
      margin-top: 1rem;
    }

    & > * {
      margin: 0.5rem 0;
    }
    --space-y: 1rem;
  }
</style>
