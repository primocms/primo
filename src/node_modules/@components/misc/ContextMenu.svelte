<script>

  const buttons = [
    {
      label: 'Invite user',
      onclick: () => {
        alert('invite user')
      }
    },
    {
      label: 'Settings',
      onclick: () => {
        alert('settings')
      }
    }
  ]

</script>

<nav>
  <ul>
    {#each buttons as button}
      <li>
        <button on:click={button.onclick}>{button.label}</button>
      </li>
    {/each}
  </ul>
</nav>

<style>
  nav {
    /* @apply invisible opacity-0 pointer-events-none; */
    @apply absolute w-32 z-10 text-gray-100 bg-gray-200 px-4 py-2 text-sm transition duration-200 shadow-md;
    left: 50%;
    transform: translateX(-50%);
    top: calc(100% + 0.75rem);
  }

  nav:before, nav:after {
    content: " ";
    @apply h-0 w-0 border-solid border-gray-800;
    border-top-color: transparent;
    border-left-color: transparent;
    border-right-color: transparent;
    bottom: 100%;
    left: 50%;
    position: absolute;
    pointer-events: none;
  }

  nav:after {
    border-width: 7px;
    margin-left: -7px;
  }
  nav:before {
    border-width: 7px;
    margin-left: -7px;
  }

  ul {
    @apply list-none;
  }

  button {
    @apply text-gray-900;
  }
</style>