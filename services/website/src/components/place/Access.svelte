<script lang="ts">
    import { DeviceSafe as Device } from "@shared/prisma-browser";

    let {
        playableDevices = $bindable(),
        isBuildServer = $bindable(),
        maxPlayers = $bindable(),
        vipEnabled = $bindable(),
        vipPrice = $bindable()
    } = $props();

    let marketplaceFee = $state(0);
    let youEarn = $state(0);

    function toggleDevice(device: Device) {
        if (playableDevices.includes(device)) {
            playableDevices = playableDevices.filter((d: Device) => d !== device);
        } else {
            playableDevices = [...playableDevices, device];
        }
    }

    function isDeviceSelected(device: Device) {
        return playableDevices.includes(device);
    }

    $effect(() => {
        const price = Number(vipPrice) || 0;
        marketplaceFee = Math.max(Math.floor(price * 0.3), 1);
        youEarn = Math.max(price - marketplaceFee, 0);
    });
</script>

<h3 class="text-3xl font-medium mb-2">Access</h3>

<div class="mt-6 flex flex-col">
    <span class="font-semibold">Playable devices:</span>
    <label class="font-normal flex mt-2">
        <input
            type="checkbox"
            class="mr-2 mb-0.5"
            checked={isDeviceSelected(Device.Computer)}
            onchange={() => toggleDevice(Device.Computer)}
        >
        Computer
    </label>
    <label class="font-normal flex mt-2">
        <input
            type="checkbox"
            class="mr-2 mb-0.5"
            checked={isDeviceSelected(Device.Phone)}
            onchange={() => toggleDevice(Device.Phone)}
        >
        Phone
    </label>
    <label class="font-normal flex mt-2">
        <input
            type="checkbox"
            class="mr-2 mb-0.5"
            checked={isDeviceSelected(Device.Tablet)}
            onchange={() => toggleDevice(Device.Tablet)}
        >
        Tablet
    </label>
</div>

<div class="mt-6 flex flex-col">
    <span class="font-semibold">Place Type:</span>
    <div class="tabs-pills !mb-0 mt-2">
        <div data-tabs-list>
            <button
                data-tabs-trigger
                data-state={isBuildServer ? undefined : 'active'}
                onclick={() => isBuildServer = false}
            >
                Game Place
            </button>
            <button
                data-tabs-trigger
                data-state={isBuildServer ? 'active' : undefined}
                onclick={() => isBuildServer = true}
            >
                Personal Server
            </button>
        </div>
    </div>
</div>

<div class="mt-6 flex flex-col">
    <span class="font-semibold">Maximum Player Count:</span>
    <select
        class="form-select w-[37px] mt-2.5"
        bind:value={maxPlayers}
    >
        {#each Array.from({ length: 50 }, (_, i) => i + 1) as num}
            <option value={num}>{num}</option>
        {/each}
    </select>
</div>

<div class="mt-6 flex flex-col">
    <span class="font-semibold">VIP Servers:</span>
    <label class="font-normal flex mt-2">
        <input
            type="checkbox"
            class="mr-2 mb-0.5"
            bind:checked={vipEnabled}
        >
        Allow VIP Servers
    </label>

    <span class="font-normal mt-1">There are currently 0 VIP Servers active for this place. Disabling VIP Servers will disable all of these VIP Servers.</span>
    <span class="font-normal mt-0.5">There are currently 0 VIP Server Subscriptions active for this place. Changing the price will cancel all of these subscriptions.</span>

    <span class="font-normal mt-0.5">Price:</span>
    <div class="flex flex-row mt-1.5 items-center">
        <span class="robux h-[12px]">
            <input
                class="text-box text-box-medium !text-black !text-[14px] w-[130px] ml-0.5"
                bind:value={vipPrice}
                minlength="1"
                maxlength="30"
                type="text"
            >
        </span>
    </div>

    <span class="font-medium mt-1.5">Marketplace Fee:</span>
    <span class="font-medium text-[#777] mt-0.5">(30% - minimum 1)</span>
    <span class="robux mt-0.5">{marketplaceFee}</span>

    <span class="font-normal mt-0.5">You Earn:</span>
    <span class="robux mt-0.5">{youEarn}</span>
</div>