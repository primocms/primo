<script>
  import { crossfade } from 'svelte/transition';
  import { flip } from 'svelte/animate';
  export let items;
  export let minColWidth = 330;
  export let maxColWidth = 500;
  export let gap = 20;
  export let id = `id`; // https://svelte.dev/tutorial/keyed-each-blocks
  export let masonryWidth = 0;
  export let masonryHeight = 0;
  export let animate = true;
  const [send, receive] = crossfade({
    duration: (d) => Math.sqrt(d * 200),
    fallback(node) {
      const style = getComputedStyle(node);
      const transform = style.transform === `none` ? `` : style.transform;
      return {
        duration: 500,
        css: (t) => `
					transform: ${transform} scale(${t});
					opacity: ${t}
				`,
      };
    },
  });
  $: nCols = Math.min(
    items.length,
    Math.floor(masonryWidth / (minColWidth + gap)) || 1
  );
  $: itemsToCols = items.reduce(
    (cols, item, idx) => {
      cols[idx % cols.length].push([item, idx]);
      return cols;
    },
    Array(nCols)
      .fill(null)
      .map(() => [])
  );
  function getId(item) {
    if ([`string`, `number`].includes(typeof item)) return item;
    if (typeof item === `object` && id in item) return item[id];
  }

</script>

<div
  class="masonry"
  bind:clientWidth={masonryWidth}
  bind:clientHeight={masonryHeight}
  style="gap: {gap}px;">
  {#each itemsToCols as col}
    <div class="col" style="gap: {gap}px; max-width: {maxColWidth}px;">
      {#if animate}
        {#each col as [item, idx] (getId(item) ?? idx)}
          <div
            in:receive={{ key: getId(id) ?? idx }}
            out:send={{ key: getId(id) ?? idx }}
            animate:flip={{ duration: 200 }}>
            <slot {idx} {item} />
          </div>
        {/each}
      {:else}
        {#each col as [item, idx] (getId(item) ?? idx)}
          <slot {idx} {item} />
        {/each}
      {/if}
    </div>
  {/each}
</div>

<style>
  .masonry {
    display: flex;
    justify-content: center;
    overflow-wrap: anywhere;
    box-sizing: border-box;
  }
  .col {
    display: grid;
    height: max-content;
    width: 100%;
  }

</style>
