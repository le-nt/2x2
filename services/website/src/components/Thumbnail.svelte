<script lang="ts">
    import { onMount } from "svelte";
    import { ThumbnailType } from "@/types/thumb";

    let { type, id, height, width, class: extraClass = "" } = $props();
    let cdnUrl = $state("");
    let imageLoaded = $state(false);

    const Blocked = "/images/render/blocked.png";
    const Pending = "/images/render/pending.png";

    const onload = (img: HTMLImageElement, callback: () => void) => {
        if (img.complete) {
            imageLoaded = true;
        } else {
            img.addEventListener("load", callback);

            return {
                destroy() {
                    img.removeEventListener("load", callback);
                },
            };
        }
    };

    async function getThumbnailData() {
        let url = "";
        let body: any = { id, height, width };

        if (type === ThumbnailType.Avatar || type === ThumbnailType.AvatarHeadShot) {
            url = "/api/thumbnail/get-avatar";
            body.bust = type === ThumbnailType.AvatarHeadShot;
        } else {
            url = "/api/thumbnail/get-asset";
            body.game = type === ThumbnailType.Place;
        }

        const req = await fetch(url, {
            method: "POST",
            body: JSON.stringify(body),
            headers: {
                "Content-Type": "application/json",
            },
        });

        if (req.ok) {
            const { imageUrl } = await req.json();
            return imageUrl;
        } else {
            return Blocked;
        }
    }

    onMount(async () => {
        cdnUrl = await getThumbnailData();
    });
</script>

{#if cdnUrl != ""}
    <img
        class="avatar-image object-fill {extraClass ??
            ''} {imageLoaded === false ? 'hidden' : ''}"
        src={cdnUrl ?? Pending}
        use:onload={() => (imageLoaded = true)}
        alt="Thumbnail"
        style="width: 100%; height: 100%"
    />
{/if}