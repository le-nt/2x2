<script lang="ts">
    import { setTitle } from "@client/stores";
    import Button from "@components/legacy/Button.svelte";

    let { data } = $props();
    let errorTitle = $state("");
    let errorDescription = $state("");
    let errorImage = $state(`/images/error/${data.code}.png`);

    switch (data.code) {
        case 404:
            errorTitle = "Requested page not found";
            errorDescription =
                "You may have clicked an expired link or mistyped the address.";
            break;
        case 403:
            errorTitle = "Access Denied";
            errorDescription =
                "Sorry, you don't have permission to view this page!";
            break;
        default:
            errorTitle = "Unexpected error with your request";
            errorDescription = "Please try again after a few moments.";
            errorImage = "/images/error/500.png";
            break;
    }

    setTitle("ROBLOX Error");
</script>

<!-- todo: requires mobile optimisations. -->
<div class="mt-8 w-full">
    <div class="flex flex-col items-center justify-center">
        <div class="flex flex-col items-center justify-center text-center">
            <img src={errorImage} alt="Alert" />

            <h1 class="mt-5">
                <span class="font-bold text-center text-gray-800 tracking-[-2px] text-[40px]">{errorTitle}</span>
            </h1>
            <h3>
                <span class="text-center font-bold text-[16px] mt-1">{errorDescription}</span>
            </h3>
            {#if data.code == 500}
                <p class="text-[14px] font-normal m-0 mt-2 mb-2">
                    <span>
                        If you continue to receive this page, please contact
                        customer service at
                        <span>
                            <a href="mailto:info@roblox.com">info@roblox.com</a>
                        </span>.
                    </span>
                </p>
            {/if}
            <div class="divider"></div>

            <div class="flex gap-1 justify-center mt-1">
                <Button
                    size="small"
                    href="javascript:history.back()"
                    text="Go to Previous Page"
                ></Button>
                <Button size="small" href="/" text="Return Home"></Button>
            </div>
        </div>
    </div>
</div>

<style>
    .divider {
        margin: 15px auto;
        height: 1px;
        width: 90%;
        border-top: 1px solid #ccc;
    }
</style>
