<script lang="ts">
	import { goto } from "$app/navigation";
	import { HeartPulse, HeartCrack, Plus, Info } from "lucide-svelte";
	import { ArbiterNodeStatus } from "@/types/types.js";
	import {
		Container,
		Row,
		Col,
		Button,
		Card,
		CardBody,
		Alert,
	} from "@sveltestrap/sveltestrap";
	import { setTitle } from "@client/stores";

	setTitle("Arbiter Nodes");

	let { data } = $props();
	let { flashData, arbiters } = $state(data);
	let { error, success } = $state(flashData ?? { error: null, success: null });
</script>

<Container fluid class="mt-4">
	<div class="d-flex justify-content-between align-items-center mb-4">
		<div>
			<h2 class="mb-1">Arbiter Nodes</h2>
		</div>
		<Button color="primary" onclick={() => goto("/cs/infra/machines/new")}>
			<Plus size={16} class="me-2" />
			Enroll Node
		</Button>
	</div>
    <hr />

	{#if error}
		<Alert color="danger" dismissible>
			<h4 class="alert-heading">An error occurred</h4>
			<p>{error}</p>
		</Alert>
	{/if}

	{#if success}
		<Alert color="success" dismissible>
			<h4 class="alert-heading">Success</h4>
			<p>{success}</p>
		</Alert>
	{/if}

	{#if arbiters.length === 0}
		<Card class="p-5 text-center bg-secondary-subtle">
			<p class="text-muted mb-0">
				No arbiter nodes are enrolled. Click the "Enroll Node" button to add
				one.
			</p>
		</Card>
	{:else}
		<Row>
			{#each arbiters as arbiter}
				<Col md="6" lg="4" class="mb-4">
					<Card class="h-100">
						<CardBody>
							<div
								class="d-flex justify-content-between align-items-center mb-3"
							>
								<h5 class="card-title mb-0">{arbiter.name}</h5>
								{#if arbiter.status === ArbiterNodeStatus.Online}
									<HeartPulse class="text-success" />
								{:else if arbiter.status === ArbiterNodeStatus.Offline}
									<HeartCrack class="text-danger" />
								{:else}
									<span class="text-warning">Unknown</span>
								{/if}
							</div>
							<p class="card-text text-muted mb-1">IP/URL: {arbiter.url}</p>
							<p class="card-text text-muted mb-1">Port: {arbiter.port}</p>
							<p class="card-text text-muted mb-3">
								SSL/TLS: {arbiter.https ? "Enabled" : "Disabled"}
							</p>
							<Button
								color="success"
								onclick={() => goto(`/cs/infra/machines/${arbiter.id}`)}
							>
								Edit
							</Button>
						</CardBody>
					</Card>
				</Col>
			{/each}
		</Row>
	{/if}
</Container>
