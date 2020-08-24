<script>
  import {CodeMirror} from '../../@components'
  import { compileScss } from '../../utils'
  import { settings } from '../../@stores/data'

  let { javascript } = $settings

</script>
  
<CodeMirror bind:value={javascript} mode="javascript" />