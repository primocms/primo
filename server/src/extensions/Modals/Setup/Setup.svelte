<script>
  import axios from 'axios'
  import {modal} from '@primo-app/primo'
  import {TextField,Select,PrimaryButton} from '@primo-app/ui'
  import Introduction from './Introduction.svelte'
  import Account from './Account.svelte'
  import Database from './Database.svelte'
  import Hosting from './Hosting.svelte'
  import Finalize from './Finalize.svelte'

  let current = 0
  const steps = [
    {
      component: Introduction
    },
    {
      component: Account,
      label: [ 'user', 'Account' ]
    },
    {
      component: Database,
      label: [ 'database', 'Database' ]
    },
    {
      component: Hosting,
      label: [ 'globe', 'Hosting' ]
    },
    {
      component: Finalize
    }
  ]
  $: activeStep = steps[current]

  function goToNextStep() {
    if (current === steps.length - 1) modal.hide()
    else current = current + 1
  }

</script>

{#if current !== 0}
  <div class="steps">
    <ol>
      {#each steps as {label}, i}
        {#if label}
          <li class:active={current === i}>
            <span class="n">STEP {i}</span>
            <span class="label" class:done={current > i}>
              <i class="fas fa-{current > i ? 'check' : label[0]}"></i>
              {label[1]}
            </span>
          </li>
        {/if}
      {/each}
    </ol>
  </div>
{/if}

<div class="p-3 text-gray-900">
  <svelte:component this={activeStep.component} on:click={goToNextStep} />
</div>

{#if current !== steps.length}
  <a href="https://discord.gg/RmjYqDq" target="blank" class="self-start help" title="#help">
    <i class="fas fa-life-ring text-red-400 transition-colors duration-100 hover:text-red-600"></i>
  </a>
{/if}

<style>
  .help {
    margin-left: -0.25rem;
    margin-bottom: -0.25rem;
  }

  .steps {

  }

  .steps ol {
    margin: -0.76rem;
    @apply bg-codeblack grid grid-cols-3 mb-0 border-b-4;
  }

  .steps li {
    @apply flex flex-col flex-1 px-5 py-3 border-b-4 transition-colors duration-1000;
    margin-bottom: -4px;
  }

  .steps li i {
    @apply mr-1 text-xs;
  }

  .steps span.n {
    @apply text-xs text-gray-700 font-bold;
  }

  .steps span.label {
    @apply text-sm font-semibold text-gray-600;
  }

  .steps span.label.done {
    @apply text-green-600 transition-colors duration-1000;
  }

  .steps li.active {
    @apply border-primored transition-colors duration-1000;
  }

  .steps li.active span.n {
    @apply text-gray-500;
  }

  .steps li.active span.label {
    @apply text-sm font-semibold text-white;
  }

</style>