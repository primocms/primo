<script>
 let { environment, heading, items = [] } = $props()
 let count = $state(0)
</script>
<section data-primo-launch-fixture={environment}>
 <h1 data-primo-qa-heading>{heading}</h1>
 <ul>{#each items as item}<li>{item.name}<ul>{#each item.links ?? [] as link}<li>{link.label}</li>{/each}</ul></li>{/each}</ul>
 <button type="button" data-primo-qa-counter onclick={() => count++}>Count {count}</button>
</section>
<style>
 section { box-sizing: border-box; max-width: 100%; padding: 1rem; overflow-wrap: anywhere; }
 h1 { color: rgb(12, 34, 56); font-size: 2rem; }
 button { min-width: 44px; min-height: 44px; }
</style>
