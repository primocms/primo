<script>
  import { createEventDispatcher } from 'svelte'
  import sites from '../../stores/sites'
  import { stores } from '@primo-app/primo'
  import SiteThumbnail from '$lib/components/SiteThumbnail.svelte'
  import Spinner from '$lib/ui/Spinner.svelte'

  const dispatch = createEventDispatcher()

  const { saved } = stores

  function warn(e) {
    if (!$saved) {
      window.alert(
        `Save your site before navigating away so you don't lose your changes`
      )
      e.preventDefault()
    } else {
      dispatch('toggle')
    }
  }

  $: featuredSites = $sites.slice(0, 5)
</script>

<ul class="primo-reset" xyz="fade stagger stagger-2">
  {#each featuredSites as site (site.id)}
    <li class="site-item xyz-in">
      <a on:click={warn} href="/{site.id}">
        <div class="thumbnail">
          <SiteThumbnail {site} />
        </div>
        <div class="card-footer">
          <div class="site-title">
            <h2>{site.name}</h2>
            <h3>/{site.id}</h3>
          </div>
          <svg
            fill="currentColor"
            viewBox="0 0 20 20"
            xmlns="http://www.w3.org/2000/svg"
            ><path
              fill-rule="evenodd"
              d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
              clip-rule="evenodd"
            /></svg
          >
        </div>
      </a>
    </li>
  {:else}
    <div class="spinner">
      <Spinner />
    </div>
  {/each}
</ul>

<style lang="postcss">
  .thumbnail {
    height: 100%;
    width: 100%;
  }
  ul {
    margin-bottom: 1rem;
    list-style-type: none;

    .site-item {
      color: var(--primo-color-white);
      background: var(--color-gray-9);
      border-radius: var(--primo-border-radius);
      overflow: hidden;
      box-shadow: var(--box-shadow-lg);
      position: relative;
      margin-bottom: 0.75rem;
      transition: 0.1s box-shadow;

      &:hover {
        box-shadow: var(--primo-ring-primored);
      }

      a {
        display: flex;
        flex-direction: column;
        width: 100%;
        height: 100%;
        transition: opacity 0.1s;

        .thumbnail {
          width: 100%;
          overflow: hidden;
          --thumbnail-height: 50%;
        }

        .card-footer {
          z-index: 10;
          font-size: var(--font-size-1);
          padding: 1rem;
          transition: background 0.1s, color 0.1s;
          display: flex;
          justify-content: space-between;
          align-items: center;
          width: 100%;

          .site-title {
            height: 100%;
            display: flex;
            flex-direction: column;
            justify-content: center;
            font-size: var(--font-size-1);

            h2 {
              line-height: 1.5;
              color: var(--color-gray-1);
              font-weight: 600;
              margin-bottom: 2px;
            }

            h3 {
              line-height: 1.5;
              color: var(--color-gray-2);
            }
          }

          svg {
            color: var(--color-white);
            height: 1.5rem;
            width: 1.5rem;
          }
        }
      }
    }

    .spinner {
      display: flex;
      justify-content: center;
    }
  }
</style>
