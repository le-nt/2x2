<script>
    import Button from "@components/legacy/Button.svelte";
    import { goto } from "$app/navigation";
    import { AssetGenre, AssetType } from "@/types/types.js";
    import { api } from "@client/api";
    import BasicSettings from "@components/place/BasicSettings.svelte";

    let name = $state("");
    let description = $state("");
    let genre = $state(AssetGenre.All);

    async function createPlace() {
        if (name.length < 1 || name.length > 30) {
            alert("Name must be between 1 and 30 characters.");
            return;
        }
        if (description.length > 100) {
            alert("Description must be 100 characters or less.");
            return;
        }

        const { data, error } = await api.develop.create.post(fetch, {
            body: { name, description, type: AssetType.Place, genre }
        })
        if (error) {
            alert(error.value);
            return;
        }
        goto(`/ide/upload?assetId=${data}`);
    }
</script>

<form class="h-full relative" method="post">
    <div class="px-4 py-4">
        <BasicSettings bind:name={name} bind:description={description} bind:genre={genre} />
    </div>

    <div class="absolute bottom-0 divider-top w-full">
        <div class="mx-[19px] mt-[10px] mb-[12px]">
            <Button type="primary" text="Create Place" size="medium" onclick={createPlace} />
            <Button class="ml-1" type="negative" text="Cancel" size="medium" onclick={() => goto("/ide/publish")} />
        </div>
    </div>
</form>