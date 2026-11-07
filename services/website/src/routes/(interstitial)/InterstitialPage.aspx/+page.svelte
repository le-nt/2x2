<svelte:head>
	<title>Wait Up!</title>
</svelte:head>

<div class="min-h-screen flex items-center justify-center p-4">
	<form
		class="w-full max-w-600px bg-#f4f4f4 border-1 border-solid border-black font-verdana text-#222 mx-auto p-4"
		method="POST"
	>
		<h1 class="text-1.4rem font-bold mb-2 text-#111 text-center">Hi</h1>
		<p class="text-1rem text-#333 text-center my-2">
			Welcome to 2x2.<br />
			Unfortunately, we've had an influx in bot activity in recent times, so we're implementing an extra step to ensure you're not a <b>clanker</b>.
		</p>

		<div class="my-4">
			<ul class="pl-5 text-0.95rem">
				<li>You agree we are <b>not</b> affiliated with Roblox Corporation</li>
				<li>
					You agree that you are not using any automated tools or scripts to access or interact with
					this website
				</li>
				<li>You acknowledge this is not a phishing attempt</li>
			</ul>
		</div>

		<div>
			<p class="text-1rem text-#333 text-center my-2">
				By continuing to use 2x2, you agree to the above statements.
			</p>
			<hr class="my-2" />
			<div class="flex justify-center mt-3">
				<button type="submit" class="px-6 py-2.5 text-1rem cursor-pointer">I Agree</button>
				<button
					type="button"
					class="ml-4 px-6 py-2.5 text-1rem cursor-pointer"
                    on:click={
                        () => {
                            document.location.href = "/videos/fuckyou.mp4"
                        }
                    }
				>
					Reject
				</button>
			</div>
		</div>
	</form>
</div>

