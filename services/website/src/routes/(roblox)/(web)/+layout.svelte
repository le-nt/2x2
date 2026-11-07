<script lang="ts">
    import Header from "@components/layout/Header.svelte";
    import Footer from "@components/layout/Footer.svelte";
    import Sidebar from "@components/layout/Sidebar.svelte";
    import { browser } from "$app/environment";
    import { page } from "$app/state";
    import Sitewide from "@components/layout/Sitewide.svelte";

    let { children, data } = $props();
    let sidebarOpen = $state(false);
    let previousPath = $state("");

    // TODO: move this to a config
    let legacyPages = [ // * Pages that use legacy layout
        "/newlogin",
        "/RobloxDefaultErrorPage.aspx",
        "/Forum",
        "/Login/ResetPasswordRequest.ashx",
        "/develop",
        "/places",
        "/info/tos",
        "/info/privacy",
        "/not-approved",
    ];
    let noFooterPages = [
        "/not-approved",
    ]
    let nonStandardPages = [ // * Pages that don't use the layout
        "/games/start",
    ];

    const pathName = $derived(page.url.pathname);
    const isLegacyPage = $derived(legacyPages.some(path => pathName.startsWith(path)));

    if (browser) {
        $effect(() => {
            if (previousPath !== page.url.pathname) {
                previousPath = page.url.pathname;
                sidebarOpen = false;
            }
        });
    }
</script>

{#if isLegacyPage}
    <style>
        div {
            font-size: 14px;
        }
    </style>
{/if}

{#if !nonStandardPages.includes(pathName)}
    <div class="h-full flex flex-col">
        <Header bind:sidebarOpen user={data.user} legacyPage={isLegacyPage} />
        {#if data.user}
            <Sidebar bind:open={sidebarOpen} user={data.user} legacyPage={isLegacyPage} />
        {/if}

        {#if isLegacyPage}
            <div class="mt-20 md:mt-10">
                <Sitewide />
            </div>
            <main class="flex flex-row justify-center">
                <div class="max-w-[970px] min-h-[550px] w-full mt-[10px] mb-[25px]">
                    {@render children?.()}
                </div>
            </main>
        {:else}
            <main class="mt-20 md:mt-10 bg-[#f2f2f2]">
                <Sitewide />
                <div class="content" class:logged-in={!!data.user}>
                    {@render children?.()}
                </div>
            </main>
        {/if}

        {#if !noFooterPages.includes(pathName)}
        <Footer />
        {/if}
    </div>
{:else}
    {@render children?.()}
{/if}

<style>
    .content {
        max-width: 1338px;
        background-color: #f2f2f2;
        padding-top: 12px;
        margin: 0 auto;
        margin-bottom: 40px;
        padding-bottom: 40px;
    }

    @media (max-width: 1154px) {
        .content {
            max-width: 970px;
        }
    }

    @media (max-width: 1338px) {
        .content {
            max-width: 1154px;
        }
    }
</style>