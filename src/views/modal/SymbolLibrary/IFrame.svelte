<script>
    import { onMount } from 'svelte';
    import Spinner from '../../../components/misc/Spinner.svelte';
    import { iframePreview } from '../../../components/misc/misc';

    export let componentApp;
    let container;
    let iframe;
    let iframeLoaded;
    $: componentApp && iframeLoaded && setIframeContent({ componentApp });
    function setIframeContent({ componentApp }) {
        iframe.contentWindow.postMessage({ componentApp });
    }

    function resizePreview() {
        const { clientWidth: parentWidth } = container;
        const { clientWidth: childWidth } = iframe;
        const scaleRatio = parentWidth / childWidth;
        iframe.style.transform = `scale(${scaleRatio})`;
        iframe.style.height = 100 / scaleRatio + '%';
    }

    onMount(resizePreview);

</script>

{#if !iframeLoaded}
    <div
        class="loading bg-gray-900 w-full h-full left-0 top-0 absolute flex justify-center items-center z-50">
        <Spinner />
    </div>
{/if}
<div bind:this={container}>
    <iframe
        on:load={() => (iframeLoaded = true)}
        title="Preview HTML"
        srcdoc={iframePreview}
        class="bg-white w-full h-full"
        bind:this={iframe} />
</div>

<style>
    iframe {
        pointer-events: none;
        width: 100vw;
        transform-origin: top left;
    }

</style>
