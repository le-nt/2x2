<script lang="ts">
	import { api } from "@client/api";
	import { EscalationSafe } from "@shared/prisma-browser";
	import { AccountStatus } from "@/types/roblox";
	import { setTitle } from "@client/stores";
	import {
		Container,
		Button,
		Input,
		FormGroup,
		Alert,
	} from "@sveltestrap/sveltestrap";
	import { hasHigherTrait } from "@client/traits";
	import { UserAdminTraitSafe } from "@shared/prisma-browser";

	let { data } = $props();
	let user = $derived(data.user);
	let userId = $derived(data.user.id);

	let currentMod = $derived(data.user.latestModeration);
	let isCurrentlyBanned = $derived(
		currentMod &&
			!currentMod.resolved &&
			currentMod.action !== EscalationSafe.Unban &&
			data.user.accountStatus !== AccountStatus.Ok
	);

	setTitle(`Moderate`);

	let reason = $state("");
	let internalNotes = $state("");
	let override = $state<string | null>(null);
	let error = $state("");
	let success = $state("");
	let loading = $state(false);

	const reasons = {
		spam: { label: "Spamming", text: "Do not spam on ROBLOX!" },
		harassment: {
			label: "Harassment",
			text: "Do not harass or bully other users on ROBLOX.",
		},
		inappropriate: {
			label: "Inappropriate Content",
			text: "Do not post inappropriate or offensive content on ROBLOX.",
		},
		inappropriateTalk: {
			label: "Inappropriate Talk",
			text: "Engaging in inappropriate talk or language is not allowed on ROBLOX.",
		},
		unfairAdvantage: {
			label: "Unfair Advantage",
			text: "Exploiting bugs to gain an unfair advantage is prohibited.",
		},
		unfairAdvantageAltsOrBots: {
			label: "Unfair Advantage (Alts/Bots)",
			text: "Using alternate accounts or bots to gain an unfair advantage is prohibited.",
		},
		scamming: {
			label: "Scamming",
			text: "Do not attempt to scam or deceive other users.",
		},
		impersonation: {
			label: "Impersonation",
			text: "Impersonating other users or staff members is not permitted.",
		},
		phishing: {
			label: "Phishing",
			text: "Do not attempt phishing attacks or social engineering.",
		},
		adultContent: {
			label: "Adult Content",
			text: "Adult or NSFW content is not allowed on ROBLOX.",
		},
	};

	function play_low_honor_sound() {
		const audio = new Audio("/audio/lowhonor.mp3");
		audio.volume = 1;
		audio.play();
	}

	async function ban() {
		if (!override) {
			error = "Please select an escalation level";
			return;
		}
		if (!reason && !internalNotes) {
			error = "Please provide a reason or internal notes for this action";
			return;
		}

		loading = true;
		error = "";
		success = "";

		try {
			const res = await api.admin.users.escalate.post(fetch, {
				params: { id: userId },
				body: {
					override,
					reason,
					internalNotes,
				},
			});

			if (res.error) {
				error = "Error: " + (res.error.value.error ?? "Unknown error");
			} else {
				if (override !== EscalationSafe.Unban) {
					play_low_honor_sound();
				}
				success = "Done!";
				reason = "";
				internalNotes = "";
				override = null;
			}
		} catch (e) {
			error = "An unexpected error occurred.";
			console.error(e);
		} finally {
			loading = false;
		}
	}
</script>

<Container fluid class="mt-3">
	{#if hasHigherTrait(user.roleSet, UserAdminTraitSafe.ProtectedUser)}
		<Alert color="info">This is a Protected User!</Alert>
	{/if}
	<h2 class="mb-2">Moderate User</h2>
	<span class="text-muted"
		>{user.username}
		<a rel="external" target="_blank" href={`/users/${user.id}/profile`}
			>profile</a
		> • <a rel="external" href={`/cs/useradmin/summary?id=${user.id}`}>summary</a></span
	>
	<hr />

	{#if error}
		<Alert color="danger" dismissible>{error}</Alert>
	{/if}

	{#if success}
		<Alert color="success" dismissible>{success}</Alert>
	{/if}

	{#if isCurrentlyBanned}
		<Alert color="warning">
			<strong>This user has unresolved enforcement</strong><br />
			Action: {currentMod.action}<br />
			{#if currentMod.cannotReactivateUntil}
				Expires: {new Date(currentMod.cannotReactivateUntil).toLocaleString()}
			{/if}
		</Alert>
	{/if}

	<div class="mb-4">
		<h5 class="mb-3">Escalation</h5>
		<div class="d-flex flex-column gap-1">
			{#each Object.entries(EscalationSafe) as [key, value]}
				<div class="form-check">
					<input
						class="form-check-input"
						type="radio"
						name="override"
						id="action-{key}"
						{value}
						bind:group={override}
					/>
					<label class="form-check-label" for="action-{key}">
						{key}
					</label>
				</div>
			{/each}
		</div>
	</div>

	<div class="mb-4">
		<h5 class="mb-3">Reason</h5>
		{#if override === EscalationSafe.Unban}
			<Alert color="warning">
				User-facing reason not required for unban — please provide internal
				notes.
			</Alert>
		{:else}
			<div class="mb-2">
				<span class="text-muted small me-2">Autofill:</span>
				<Input type="select" class="w-auto d-inline-block" bind:value={reason}>
					<option value="" disabled selected>...</option>
					{#each Object.entries(reasons) as [_, r]}
						<option value={r.text}>{r.label}</option>
					{/each}
				</Input>
			</div>
			<FormGroup>
				<Input
					type="textarea"
					rows={3}
					bind:value={reason}
					placeholder="Reason I'll hide behind..."
				/>
			</FormGroup>
		{/if}
	</div>

	<div class="mb-4">
		<h5 class="mb-3">Internal Notes</h5>
		<FormGroup>
			<Input
				type="textarea"
				rows={2}
				bind:value={internalNotes}
				placeholder="Actual reason..."
			/>
		</FormGroup>
	</div>

	<Button color="primary" onclick={ban} disabled={loading}>
		{loading ? "Processing..." : "Submit"}
	</Button>
</Container>
