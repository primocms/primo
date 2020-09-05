<form>
  <label for="context-input">Email:</label>
  <input type="text" id="context-input" />
</form>

<style>
  form {
    /* @apply invisible opacity-0 pointer-events-none; */
    @apply absolute w-32 z-10 text-gray-100 bg-gray-200 px-4 py-2 text-sm transition duration-200 shadow-md;
    left: 50%;
    transform: translateX(-50%);
    top: calc(100% + 0.75rem);
  }

  form:before, form:after {
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

  form:after {
    border-width: 7px;
    margin-left: -7px;
  }
  form:before {
    border-width: 7px;
    margin-left: -7px;
  }

</style>