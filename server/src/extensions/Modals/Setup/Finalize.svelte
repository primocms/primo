<script>
  import {PrimaryButton} from '@primo-app/ui'
  import {fade} from 'svelte/transition'

</script>

<div class="prose mb-4" in:fade>
  <h3>Success!</h3>
  <p>Hopefully that was pretty painless. It looks like everything worked out okay so you should be good to go. Just one more thing.</p>
  <p>If you enjoy using primo and want to see it grow and succeed, here are some ways you can join the effort:</p>
  <ul>
    <li>if you have free time, come <a href="https://github.com/primo-app/primo/issues" target="blank">collaborate.</a> There's a lot to be done and room for everybody.</li>
    <li>if you have developer friends, tell them about primo.</li>
    <li>if you have a YouTube channel, publish a video of you developing a site with primo.</li>
    <li>if you find a bug, file a <a href="https://github.com/primo-app/primo/issues/new">bug report</a>.</li>
    <li>if you like making friends out of internet strangers, come join our <a href="https://discord.gg/vzSFTS9">Discord</a>.</li>
  </ul>
  <p>Okay that's it. I hope you love using primo and all your dreams come true.</p>
  <p>Take care,<br>Mateo</p>
</div>
<PrimaryButton on:click>Start Building</PrimaryButton>
