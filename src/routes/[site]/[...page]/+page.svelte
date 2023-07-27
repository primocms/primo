<script>
  import { PrimoPage } from '@primocms/builder'

  export let data
</script>

<PrimoPage
  page={{
    ...data.page,
    sections: data.sections,
  }}
/>
