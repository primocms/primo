<script>
  import { link } from "svelte-routing";

  const date = new Date();  
  const month = date.toLocaleString('default', { month: 'long' });
</script>

<footer class="container max-w-2xl">
  <span class="disclaimer">
    <span class="primo">primo</span> is in public beta as of {month} 2020
  </span>
  <div class="footer-links">
    <div>
      <!-- <a use:link href="/about">About</a> -->
      <!-- | <a use:link href="/pricing">Pricing</a> -->
      <a href="https://discuss.primo.so">Community</a>
      | <a href="https://www.iubenda.com/terms-and-conditions/39882203" class="iubenda-nostyle no-brand iubenda-embed" title="Terms and Conditions ">Terms</a><script type="text/javascript">(function (w,d) {var loader = function () {var s = d.createElement("script"), tag = d.getElementsByTagName("script")[0]; s.src="https://cdn.iubenda.com/iubenda.js"; tag.parentNode.insertBefore(s,tag);}; if(w.addEventListener){w.addEventListener("load", loader, false);}else if(w.attachEvent){w.attachEvent("onload", loader);}else{w.onload = loader;}})(window, document);</script>
      | <a href="https://www.iubenda.com/privacy-policy/39882203" class="iubenda-nostyle no-brand iubenda-embed" title="Privacy Policy ">Privacy</a><script type="text/javascript">(function (w,d) {var loader = function () {var s = d.createElement("script"), tag = d.getElementsByTagName("script")[0]; s.src="https://cdn.iubenda.com/iubenda.js"; tag.parentNode.insertBefore(s,tag);}; if(w.addEventListener){w.addEventListener("load", loader, false);}else if(w.attachEvent){w.attachEvent("onload", loader);}else{w.onload = loader;}})(window, document);</script>
      <!-- | <a href="https://www.iubenda.com/privacy-policy/39882203/cookie-policy" class="iubenda-nostyle no-brand iubenda-embed" title="Cookie Policy ">Cookie Policy</a><script type="text/javascript">(function (w,d) {var loader = function () {var s = d.createElement("script"), tag = d.getElementsByTagName("script")[0]; s.src="https://cdn.iubenda.com/iubenda.js"; tag.parentNode.insertBefore(s,tag);}; if(w.addEventListener){w.addEventListener("load", loader, false);}else if(w.attachEvent){w.attachEvent("onload", loader);}else{w.onload = loader;}})(window, document);</script> -->
    </div>
    <span class="copyright primo">©</span>
  </div>
</footer>

<style>
  footer {
    @apply text-gray-300 flex flex-col justify-center w-full;
  }

  a {
    @apply text-gray-300 transition-colors duration-200;
    &:hover {
      @apply text-white;
    }
  }

  .footer-links {
    display: flex;
    flex-direction: row;
    justify-content: space-between;
  }

  .footer-links a {
    margin: 0 0.5rem;
  }

  .footer-links a:first-child {
    margin-left: 0;
  }

  .disclaimer {
    display: block;
  }

  .primo {
    font-weight: 800;
    @apply text-primored;
  }
</style>