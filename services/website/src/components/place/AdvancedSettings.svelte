<script lang="ts">
    import { AssetCategory } from "@/types/types";
    import { ChatStyleSafe as ChatStyle } from "@shared/prisma-browser";

    let {
        allowAnyGearGenre = $bindable(),
        allowedGearCategories = $bindable(),
        chatType = $bindable(),
        copyLocked = $bindable(),
        commentsAllowed = $bindable()
    } = $props();

    const categories = [
        { label: "Melee weapons", value: AssetCategory.Melee },
        { label: "Power ups", value: AssetCategory.PowerUps },
        { label: "Ranged weapons", value: AssetCategory.Ranged },
        { label: "Navigation enhancers", value: AssetCategory.Navigation },
        { label: "Explosives", value: AssetCategory.Explosive },
        { label: "Musical instruments", value: AssetCategory.Music },
        { label: "Social items", value: AssetCategory.Social },
        { label: "Personal transport", value: AssetCategory.PersonalTransport },
        { label: "Building tools", value: AssetCategory.Building }
    ];
</script>

<h3 class="text-3xl font-medium mb-2">Gear Permissions</h3>

<div class="mt-6 flex flex-col">
    <span class="font-semibold">Allowed Genre:</span>
    <label class="font-normal mt-3">
        <input
            type="radio"
            class="mr-1"
            name="allowedGenre"
            bind:group={allowAnyGearGenre}
            value={false}
        />
        Game genre (All)
    </label>
    <label class="font-normal mt-4">
        <input
            type="radio"
            class="mr-1"
            name="allowedGenre"
            bind:group={allowAnyGearGenre}
            value={true}
        />
        All genres
    </label>
</div>

<div class="mt-7 mb-4 flex flex-col">
    <span class="font-semibold mb-3">Gear Types:</span>
    <div class="grid grid-cols-3 grid-rows-3 gap-2 w-[500px] ml-10.5">
        {#each categories as { label, value }}
            <label class="font-normal flex">
                <input
                    type="checkbox"
                    class="mr-2 mb-0.5"
                    bind:group={allowedGearCategories}
                    value={value}
                />
                {label}
            </label>
        {/each}
    </div>
</div>

<h3 class="text-3xl font-medium mb-2 divider-top pt-3.5">Other Permissions</h3>

<div class="mt-6 flex flex-col">
    <span class="font-semibold">Chat Type:</span>
    <select class="form-select w-[70px] mt-2.5" bind:value={chatType}>
        <option value={ChatStyle.Classic}>Classic</option>
        <option value={ChatStyle.Bubble}>Bubble</option>
        <option value={ChatStyle.ClassicAndBubble}>Both</option>
    </select>
</div>

<div class="mt-6 flex flex-col">
    <label class="font-normal flex">
        <input type="checkbox" class="mr-2 mb-0.5" bind:checked={copyLocked} />
        Copy Locked
    </label>
    <label class="font-normal flex mt-2">
        <input type="checkbox" class="mr-2 mb-0.5" bind:checked={commentsAllowed} />
        Comments Allowed
    </label>
</div>