<script lang="ts">
	import {
		Container,
		Row,
		Col,
		Card,
		CardBody,
		CardHeader,
		Alert
	} from "@sveltestrap/sveltestrap";
	import { setTitle } from "@client/stores";
	import { Clock, UserCheck, AlertCircle, FileText } from "lucide-svelte";
	import { onDestroy } from "svelte";
	import { writable } from "svelte/store";
	import { UserAdminTraitSafe as UserAdminTrait } from "@shared/prisma-browser";

	setTitle("Dashboard");

	let { data } = $props();
	let user = $derived(data.user);
	let expiry = $derived((data as any).admin?.expiresAt);
	
	let dashData = $derived((data as any).dashData || {
		userCount: "?",
		signUpsToday: "?",
		pendingReports: "?",
		pendingAssetQueue: "?",
	});

	function formatNumber(num: number | string) {
        return typeof num === 'number' ? num.toLocaleString() : num;
    }

	let remainingStore = writable("");
	let interval: ReturnType<typeof setInterval>;

	function updateCountdown() {
		if (!expiry) {
			remainingStore.set("N/A");
			return;
		}
		const diff = new Date(expiry).getTime() - new Date().getTime();
		if (diff <= 0) {
			remainingStore.set("Expired");
			clearInterval(interval);
			return;
		}
		const hours = Math.floor(diff / (1000 * 60 * 60));
		const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
		const seconds = Math.floor((diff % (1000 * 60)) / 1000);
		remainingStore.set(`${hours}h ${minutes}m ${seconds}s`);
	}

	$effect(() => {
		if (expiry) {
			updateCountdown();
			interval = setInterval(updateCountdown, 1000);
		}
		return () => {
			if (interval) clearInterval(interval);
		};
	});
</script>

<Container fluid class="mt-4">
	<div class="mb-4">
		<h2 class="mb-2">
			Hi <span class="fw-bold">{user?.username}</span>
		</h2>
		<p class="text-muted d-flex align-items-center gap-2">
			<Clock size={16} />
			Session expiry:
			<span class="fw-bold">{$remainingStore}</span>
		</p>
	</div>

	<Row class="mb-4">
		<Col sm="6" lg="3" class="mb-4 mb-lg-0">
			<Card class="h-100 border-success shadow-sm bg-success-subtle">
				<CardHeader class="bg-success text-white text-center">
					<h6 class="mb-0">Total Signed Up Users</h6>
				</CardHeader>
				<CardBody class="d-flex align-items-center justify-content-center">
					<h2 class="card-title mb-0">{formatNumber(dashData.userCount)}</h2>
				</CardBody>
			</Card>
		</Col>

		<Col sm="6" lg="3" class="mb-4 mb-lg-0">
			<Card class="h-100 border-primary shadow-sm bg-primary-subtle">
				<CardHeader class="bg-primary text-white text-center">
					<div class="d-flex justify-content-center align-items-center gap-2">
						<UserCheck size={18} />
						<h6 class="mb-0">Sign Ups Today</h6>
					</div>
				</CardHeader>
				<CardBody class="d-flex align-items-center justify-content-center">
					<h2 class="card-title mb-0">{formatNumber(dashData.signUpsToday)}</h2>
				</CardBody>
			</Card>
		</Col>

		<Col sm="6" lg="3" class="mb-4 mb-lg-0">
			<Card class="h-100 border-danger shadow-sm bg-danger-subtle">
				<CardHeader class="bg-danger text-white text-center">
					<div class="d-flex justify-content-center align-items-center gap-2">
						<AlertCircle size={18} />
						<h6 class="mb-0">Pending Abuse Reports</h6>
					</div>
				</CardHeader>
				<CardBody class="d-flex align-items-center justify-content-center">
					<h2 class="card-title mb-0">{formatNumber(dashData.pendingReports)}</h2>
				</CardBody>
			</Card>
		</Col>

		<Col sm="6" lg="3" class="mb-4 mb-lg-0">
			<Card class="h-100 border-warning shadow-sm bg-warning-subtle">
				<CardHeader class="bg-warning text-white text-center">
					<div class="d-flex justify-content-center align-items-center gap-2">
						<FileText size={18} />
						<h6 class="mb-0">Pending Asset Approvals</h6>
					</div>
				</CardHeader>
				<CardBody class="d-flex align-items-center justify-content-center">
					<h2 class="card-title mb-0">{formatNumber(dashData.pendingAssetQueue)}</h2>
				</CardBody>
			</Card>
		</Col>
	</Row>

	<h3 class="mb-3">Notices</h3>
	<Alert color="warning" class="mb-4" heading="Hold up!">
		<p>
			<b class="text-decoration-underline">To all moderators</b>: If you wish to moderate the
			Forum, use the <a href="/Forum/Default.aspx" class="alert-link">main website</a>.<br /> All
			staff have elevated access to the Forum, and can view & moderate hidden
			posts.
		</p>
		<hr />
		<p class="mb-0 fw-bold">Thanks!</p>
	</Alert>
</Container>
