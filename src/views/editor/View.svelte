<script>
  import Section from './Layout/Section.svelte'
  import Column from './Layout/Column.svelte'
  import ContentNode from './Layout/ContentNode.svelte'
  import ComponentNode from './Layout/ComponentNode.svelte'
  import content from '../../stores/data/page/content'

</script>

{#each $content as section, i (section.id)}
  <Section {section}>
    {#each section.columns as column, i (column.id)}
      <Column {column}>
        {#each column.rows as row, i (row.id)}
          {#if row.type === 'component'}
            <ComponentNode {row} />
          {:else}
            <div class="primo-copy">
              {@html row.value.html}
            </div>
          {/if}
        {/each}
      </Column>
    {/each}
  </Section>
{/each}
