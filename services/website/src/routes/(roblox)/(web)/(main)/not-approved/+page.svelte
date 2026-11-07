<script lang="ts">
    import { api } from "$lib/client/api";

    const { data } = $props();
    const banData = data.banData;

    let agreed = $state(false);

    async function reactivate() {
        if (!agreed) return;
        const res = await api.reactivate.post(fetch);
        if (res.error) {
            alert(res.error.value.error || "Failed to reactivate");
        } else {
            window.location.href = "/home";
        }
    }

    async function logout() {
        await api.logout.get(fetch);
        window.location.href = "/";
    }
</script>

<div class="flex items-center justify-center h-[50vh]">
	<div class="border border-solid border-black mx-auto p-[30px] max-w-[500px]">
		<h2>{banData.banTypeUserFriendly}</h2>
		<div class="ml-2">
			<p class="font-normal mt-2">
				Our content monitors have determined that your behavior at Roblox has
				been in violation of our Terms of Service.
			</p>

			<p class="font-normal mt-3.5">
				Reviewed:
				<span class="font-semibold">
					{new Date(banData.reviewed).toLocaleDateString("en-GB")}
					{new Date(banData.reviewed).toLocaleTimeString("en-US")}
				</span>
			</p>

			<p class="font-normal mt-3.5">
				Moderator Note:
				<span class="font-semibold">{banData.moderatorNote}</span>
			</p>

			{#if banData.isTermination}
				<p class="font-normal mt-3.5">Your account has been terminated.</p>
				<p class="font-normal mt-3">
					If you wish to appeal, please contact us via the
					<a href="/not-approved">fuck you</a>.
				</p>
			{:else}
				<p class="font-normal mt-3.5">
					Please abide by the
					<a href="/info/tos">ROBLOX Community Guidelines</a>
					so that ROBLOX can be fun for users of all ages.
				</p>

				{#if banData.canReactivate}
					<p class="font-normal mt-3.5">
						You may re-activate your account by agreeing to our
						<a href="/info/tos">Terms of Service</a>.
					</p>
					<div class="text-center font-normal mt-4">
						<input type="checkbox" bind:checked={agreed} id="checkbox" />
						<label for="checkbox">I Agree</label>
					</div>
				{:else}
					<p class="font-normal mt-3.5">
						Your account has been disabled. You may re-activate it after
						<span class="font-semibold">
							{new Date(banData.canReactivateAt).toLocaleDateString("en-GB") +
								" " +
								new Date(banData.canReactivateAt).toLocaleTimeString("en-US")}
						</span>
					</p>
					<p class="font-normal mt-3">
						If you wish to appeal, please contact us via the
						<a href="/not-approved">fuck you</a>.
					</p>
				{/if}
			{/if}

            <div class="flex flex-col items-center font-normal mt-4 ">
                {#if banData.canReactivate}
                    <input 
                        value="Reactivate My Account" 
                        type="button" 
                        disabled={!agreed} 
                        onclick={reactivate}
                        class="mb-2 cursor-pointer disabled:opacity-50" 
                    />
                {/if}
				<input value="Logout" type="button" onclick={logout} class="cursor-pointer" />
            </div>
		</div>
	</div>
</div>
