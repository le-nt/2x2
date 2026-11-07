<script lang="ts">
	import {
		Container,
		Row,
		Col,
		Card,
		CardBody,
		CardHeader,
		CardText,
		Button,
		Toast,
		ToastBody,
		ToastHeader,
	} from "@sveltestrap/sveltestrap";
	import { api } from "@client/api";
	import { setTitle } from "@client/stores";
	setTitle("Site Features")

	let { data } = $props();
	let features = $state(data.features || []);

	let toastOpen = $state(false);
	let toastMessage = $state("");
	let toastColor = $state<"success" | "danger">("success");

	function showToast(message: string, color: "success" | "danger" = "success") {
		toastMessage = message;
		toastColor = color;
		toastOpen = true;
	}

	async function handleToggle(key: string, enabled: boolean) {
		const featureIndex = features.findIndex((f: any) => f.key === key);
		if (featureIndex === -1) return;

		const originalState = features[featureIndex].enabled;
		features[featureIndex].enabled = enabled;

		try {
			const { error } = await api.admin.flags.update.post(fetch, {
				params: {
					key,
				},
				body: {
					enabled,
				},
			});

			if (error) throw error;
		} catch (e) {
			console.error("Feature toggle failed", e);
			features[featureIndex].enabled = originalState;
			showToast("Failed to update feature", "danger");
		}
	}
</script>

<Container fluid class="mt-4">
	<h2 class="mb-2">Site Features</h2>
    <p class="text-muted">Changes should replicate instantly.</p>
	<hr />

	<Row>
		{#each features as feature (feature.key)}
			<Col sm="6" lg="4" class="mb-4">
				<Card class="h-100 shadow-sm">
					<CardHeader>
						<h5 class="mb-0">{feature.displayName}</h5>
					</CardHeader>
					<CardBody class="d-flex flex-column">
						<CardText>{feature.description}</CardText>
						<div class="mt-auto d-flex gap-2">
							{#if feature.enabled}
								<Button
									color="secondary"
									class="bg-gradient"
									onclick={() => handleToggle(feature.key, false)}
									block>Disable</Button
								>
							{:else}
								<Button
									color="primary"
									class="bg-gradient"
									onclick={() => handleToggle(feature.key, true)}
									block>Enable</Button
								>
							{/if}
						</div>
					</CardBody>
				</Card>
			</Col>
		{/each}
	</Row>

	<div class="position-fixed bottom-0 end-0 p-3" style="z-index: 11">
		<Toast isOpen={toastOpen} autohide on:close={() => (toastOpen = false)}>
			<ToastHeader icon={toastColor} toggle={() => (toastOpen = false)}>
				System
			</ToastHeader>
			<ToastBody>
				{toastMessage}
			</ToastBody>
		</Toast>
	</div>
</Container>
