<script>
  import { cloneDeep as _cloneDeep } from 'lodash-es'
  import Tabs from '$lib/ui/Tabs.svelte'
  import { setCustomization } from '../../../actions'
  import config from '../../../stores/config'
  import ImageField from '../../../extensions/FieldTypes/ImageField.svelte'
  // import RepeaterField from '$lib/editor/field-types/RepeaterField.svelte'
  import Link from '$lib/editor/field-types/Link.svelte'
  import TextField from '$lib/editor/field-types/ContentField.svelte'

  const tabs = [
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
    {#if activeTab.label === 'Customize'}
      <h1 class="primo-heading-lg">Customize</h1>
      <div>
        <ImageField
          on:input={({ detail }) => setCustomization({ logo: detail.value })}
          field={{
            label: 'Logo',
            value: $config.customization.logo,
          }}
        />
        <br />
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
        <!-- <br /><br />
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
        /> -->
        <!-- <br /><br />
        <TextField
          field={_cloneDeep({
            label: 'Brand Color',
            value: $config.customization.color,
          })}
          on:input={({ detail }) =>
            setCustomization({
              color: detail.value,
            })}
        /> -->
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
