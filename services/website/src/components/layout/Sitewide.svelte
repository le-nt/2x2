<script lang="ts">
    export let message: string | null = null;
    export let link: string | null = null;
    // define bg colours like "normal" and "important"
    const bgColours = {
        alert: "#F68802",
        important: "#FE0104"
    }
    export let bgColour = bgColours.alert;
</script>

{#if message}
    <div class="w-full p-2" style="background-color: {bgColour};">
        <p class="text-white text-center text-lg font-bold">
            {#if link}
                <a href={link} class="underline font-bold text-lg text-white">{message}</a>
            {:else}
                {message}
            {/if}
        </p>
    </div>
{/if}
