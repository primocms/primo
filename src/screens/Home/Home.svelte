<script>
  import { fade } from 'svelte/transition'

  import ShortUniqueId from "short-unique-id";
  const uid = new ShortUniqueId();

  let signingUp = false
</script>

<div class="my-24 flex flex-col items-start">
  <h1 class="text-3xl md:text-5xl mt-42 mb-8" in:fade>
    <!-- primo makes it easier to make websites, a <span class="italic">lot</span> easier -->
    primo is an all-in-one IDE, CMS, component library, and static site generator
  </h1>
  <!-- <p class="text-lg text-gray-900 mt-4 font-medium" in:fade>Remember when you used to be able to make a website with just HTML, CSS, and bare-minimum JavaScript? It's time to get back to that, but with all the goodies of the modern web too.</p> -->
  <p class="text-lg text-gray-900 mt-4 font-medium" in:fade>Build sites faster, add and manage content more easily, create an actual, usable component library, and publish a fast, secure, cheaply-hosted static site. <br>
    <span class="inline-block font-bold mt-2">
      <span>For free, forever</span>
      <span class="inline-block" style="transform: scale(-1,1)">🍾</span>
    </span>
  </p>
</div>

<div class="video-container" in:fade={{ delay: 500 }}>
  <div class="videoWrapper">
    <iframe title="primo demo video" src="https://player.vimeo.com/video/437737803?autoplay=1&loop=1&background=1" width="560" height="315" webkitallowfullscreen mozallowfullscreen allowfullscreen allow=autoplay></iframe>
  </div>  
</div>

<div class="fullwidth bg-codeblack pb-4 flex flex-col items-center">
  <div class="feature-grid grid-cols-1 md:grid-cols-2 text-white">
    <div>
      <i class="fas fa-laptop-code"></i>
      <!-- <h2>Code from anywhere</h2> -->
      <h2>Get to the code</h2>
      <p>Deploy new code in seconds by editing your site <strong>component-by-component</strong> from any browser<!--<span class="text-gray-500">*</span>--> and use <a href="https://tailwindcss.com/">Tailwind</a>, <a href="https://postcss.org/">PostCSS</a>, and use your favorite libraries with <strong>zero setup</strong>.</p>
      <!-- <span class="text-xs text-gray-500 relative" style="top:1rem">*except IE11, of course</span> -->
    </div>
    <div>
      <i class="fas fa-edit"></i>
      <h2>Edit content with ease</h2>
      <p>Instead of working in a complicated backend, content gets <strong>edited on the frontend</strong>. And with separate user roles, devs can focus on the code and site users can focus on the content.</p>
    </div>
    <div>
      <i class="fas fa-th-large"></i>
      <h2>Create a component library</h2>
      <p>Create a new component, add it to your library, then <strong>place it anywhere</strong> on your site. And when you update it, every instance of it gets updated too.</p>
    </div>
    <div>
      <i class="fab fa-github"></i>
      <h2>Build to Github</h2>
      <p>Anytime you make code or content changes, a <strong>blazing fast</strong> static bundle gets built out to Github where you can deploy it to your host of choice.</p>
    </div>
    <!-- <div>
      <i class="fas fa-wind"></i>
      <h2>PostCSS/Tailwind baked in</h2>
      <p>Build custom interfaces in no time using Tailwind's intuitive utilities & use PostCSS to auto-prefix, minify, and nest your styles.</p>
    </div> -->
    <!-- <div>
      <i class="fas fa-rocket"></i>
      <h2>Use the libraries you love</h2>
      <p>Import your favorite JS/CSS libraries with <a class="underline" href="https://www.jsdelivr.com/">jsdelivr</a>. Now you're cooking with gas.</p>
    </div> -->
  </div>

    {#if !signingUp}
      <button on:click={() => signingUp = true} href="https://www.youtube.com/watch?v=w1MGtt89d9A&feature=youtu.be" class="max-w-2xl w-full mb-4 bottom-button">
        <i class="fas fa-envelope mr-2"></i>
        <span>Sign up for updates</span>
      </button>
    {:else}
      <!-- Begin Mailchimp Signup Form -->
      <div class="w-full max-w-2xl mb-4" in:fade={{duration:200}}>
        <form action="https://primo.us10.list-manage.com/subscribe/post?u=83306198b0e8191026916c27b&amp;id=131d55258f" method="post" id="mc-embedded-subscribe-form" name="mc-embedded-subscribe-form" class="validate" target="_blank" novalidate>
          <div class="flex" id="mc_embed_signup_scroll">
            <div class="flex-1 flex items-center mc-field-group">
              <label class="font-semibold mr-4 text-gray-100" for="mce-EMAIL">Email Address </label>
              <input class="h-full flex-1 required email" type="email" value="" name="EMAIL" id="mce-EMAIL">
            </div>
            <div id="mce-responses" class="clear">
              <div class="response" id="mce-error-response" style="display:none"></div>
              <div class="response" id="mce-success-response" style="display:none"></div>
            </div>    
            <!-- real people should not fill this in and expect good things - do not remove this or risk form bot signups-->
            <div style="position: absolute; left: -5000px;" aria-hidden="true"><input type="text" name="b_83306198b0e8191026916c27b_131d55258f" tabindex="-1" value=""></div>
            <button class="font-semibold py-2 px-4 text-xs bg-gray-200 hover:bg-primored hover:text-white transition-colors duration-200" type="submit" value="Subscribe" id="mc-embedded-subscribe">Subscribe</button>
          </div>
        </form>
      </div>
    {/if}

    <a href="https://www.youtube.com/watch?v=w1MGtt89d9A&feature=youtu.be" class="max-w-2xl w-full mb-8 bottom-button">
      <i class="fas fa-play mr-2"></i>
      <span>Watch walkthrough</span>
    </a>

  <slot></slot>
</div>

<style>

  @screen md {
    .video-container {
      position: relative;
      width: 140%;
      left: -20%;
      /* margin-bottom: -20rem; */
      margin-bottom: 7rem;
    }
    .videoWrapper {
        position: relative;
        /* padding-bottom: 56.25%;  */
        /* padding-top: 25px; */
        padding-bottom: 30.25%;
        padding-top: 525px;
        height: 0;
    }
    .videoWrapper iframe {
        position: absolute;
        top: 0;
        left: 0;
        height: 100%;
    }
  }

  .bottom-button {
    @apply p-2 text-center border rounded text-gray-100 transition-colors duration-200;
    &:hover {
      @apply bg-primored;
    }
  }

  .video-container {
    &, * {
      @apply bg-codeblack;
    }
  }

  .videoWrapper iframe {
      width: 100%;
  }

  strong {
    @apply text-gray-100;
  }

  .fullwidth {
    @apply w-screen relative flex justify-center px-8;
    left: 50%;
    right: 50%;
    margin-left: -50vw;
    margin-right: -50vw;
  }

  .feature-grid {
    @apply grid my-24 col-gap-24 row-gap-12 max-w-2xl;

    i {
      @apply mb-4 text-primored text-4xl;
    }
  }

  h1 {
    @apply font-black text-gray-900 leading-none;
  }

  h2 {
    @apply text-xl font-bold mb-1;
  }


</style>


<svelte:head>
	<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.11.2/css/all.min.css" integrity="sha256-+N4/V/SbAFiW1MPBCXnfnP9QSN3+Keu+NlB+0ev/YKQ=" crossorigin="anonymous" />
  <script type="text/javascript">
  var _iub = _iub || [];
  _iub.csConfiguration = {"ccpaAcknowledgeOnDisplay":true,"lang":"en","siteId":1839476,"enableCcpa":true,"countryDetection":true,"gdprAppliesGlobally":false,"consentOnDocument":true,"cookiePolicyId":39882203, "banner":{ "acceptButtonDisplay":true,"customizeButtonDisplay":true,"position":"bottom","slideDown":false,"zIndex":1000000000000000000 }};
  </script>
  <script type="text/javascript" src="//cdn.iubenda.com/cs/iubenda_cs.js" charset="UTF-8" async></script>
</svelte:head>