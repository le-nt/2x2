<script lang="ts">
	import {
		Container,
		Row,
		Col,
		Card,
		CardHeader,
		CardBody,
		Table,
		Alert,
		Badge,
		Button,
		Icon,
		Input,
		InputGroup,
		InputGroupText,
		Pagination,
		PaginationItem,
		PaginationLink,
		Dropdown,
		DropdownItem,
		DropdownMenu,
		DropdownToggle,
	} from "@sveltestrap/sveltestrap";
	import { Smile } from "lucide-svelte";
	import { setTitle } from "@client/stores";
	import Thumbnail from "@components/Thumbnail.svelte";
	import { ThumbnailType } from "@/types/thumb";
	import UserStatusBadge from "@components/admin_newdesign/UserStatusBadge.svelte";
	import { hasHigherTrait } from "@client/traits";
	import { UserAdminTraitSafe } from "@shared/prisma-browser";
	import ProtectedCheckbox from "@components/admin_newdesign/ProtectedCheckbox.svelte";
	import { api } from "@client/api";

	let { data } = $props();
	let user = $state(data.user);

	$effect(() => {
		setTitle(`${user.username}`);
	});

	let expandedRows = $state(new Set<string>());
	let currentPage = $state(1);
	const pageSize = 5;
	let newNote = $state("");
	let notesBusy = $state(false);
	let notesError = $state<string | null>(null);

	let newNoteMenuToggled = $state(false);

	function toggleRow(id: string) {
		const newSet = new Set(expandedRows);
		if (newSet.has(id)) {
			newSet.delete(id);
		} else {
			newSet.add(id);
		}
		expandedRows = newSet;
	}

	let paginatedModeration = $derived(
		user.moderation
			.slice()
			.reverse()
			.slice((currentPage - 1) * pageSize, currentPage * pageSize)
	);
	let totalPages = $derived(Math.ceil(user.moderation.length / pageSize));

	async function refreshUser() {
		const res = await api.admin.users.getUser.get(fetch, {
			params: { id: user.id },
		});
		if (res.error || !res.data?.data) {
			notesError = "Failed to refresh user";
			return;
		}
		user = res.data.data;
	}

	async function createNote() {
		notesError = null;
		const trimmed = newNote.trim();
		if (!trimmed) {
			notesError = "Note cannot be empty";
			return;
		}
		notesBusy = true;
		const res = await api.admin.users.notes.create.put(fetch, {
			params: { id: user.id },
			body: { note: trimmed },
		});
		notesBusy = false;
		if (res.error || res.data?.success === false) {
			notesError = "Failed to create note";
			return;
		}
		newNote = "";
		await refreshUser();
	}

	async function deleteNote(noteId: string) {
		notesError = null;
		notesBusy = true;
		const res = await api.admin.users.notes.delete.delete(fetch, {
			params: { id: user.id, noteId },
		});
		notesBusy = false;
		if (res.error || res.data?.success === false) {
			notesError = "Failed to delete note";
			return;
		}
		await refreshUser();
	}
</script>

<Container fluid class="mt-3">
	<Col class="mb-4" md={11}>
		{#if hasHigherTrait(user.roleSet, UserAdminTraitSafe.ProtectedUser)}
			<Alert color="info">This is a Protected User!</Alert>
		{/if}
	</Col>
	<Row>
		<Col md={5}>
			<Card class="mb-4">
				<CardHeader class="bg-primary text-white">
					<h5 class="mb-0">Account Summary</h5>
				</CardHeader>
				<CardBody>
					<Table striped>
						<tbody>
							<tr>
								<th>Username</th>
								<td>{user.username}</td>
							</tr>
							<tr>
								<th>UserID</th>
								<td>{user.id}</td>
							</tr>
							<tr>
								<th>Moderation Status</th>
								<td>
									<UserStatusBadge status={user.accountStatus} />
								</td>
							</tr>
							<tr>
								<th>RoleSet</th>
								<td>{user.roleSet}</td>
							</tr>
							<tr>
								<th>Created At</th>
								<td>{new Date(user.createdAt).toLocaleString()}</td>
							</tr>
							<tr>
								<th>Last Login</th>
								<td
									>{user.lastLogin
										? new Date(user.lastLogin).toLocaleString()
										: "Never"}</td
								>
							</tr>
							<tr>
								<th>Previous Usernames</th>
								<td>
									<span class="text-muted">None </span>
								</td>
							</tr>
							<tr>
								<th>Membership</th>
								<td class={user.membership ? "" : "text-muted"}
									>{user.membership || "None"}</td
								>
							</tr>
							<tr>
								<th>Robux</th>
								<td
									><span class="text-success">R$</span>
									{user.robux.toLocaleString()}</td
								>
							</tr>
							<tr>
								<th>Tickets</th>
								<td
									><span class="text-warning">Tx</span>
									{user.tickets.toLocaleString()}</td
								>
							</tr>
						</tbody>
					</Table>
					<div class="d-flex">
						<div style="width: 150px; height: 150px;">
							<Thumbnail
								type={ThumbnailType.Avatar}
								id={user.id}
								width={352}
								height={352}
								class="img-fluid mb-3"
							/>
						</div>
						<div class="d-flex flex-column justify-content-center ms-4">
							<a href="/users/{user.id}/profile" class="ms-3">View on ROBLOX</a>
							<a href="/cs/useradmin/ips?id={user.id}" class="ms-3"
								>View IP Addresses</a
							>
							<a href="/cs/useradmin/fingerprints?id={user.id}" class="ms-3"
								>View PII IDs</a
							>
							<a href="/cs/useradmin/moderate?id={user.id}" class="ms-3"
								>Moderate User</a
							>
						</div>
					</div>
				</CardBody>
			</Card>
			<Card class="mb-4">
				<CardHeader class="bg-warning text-dark">
					<h5 class="mb-0">Manual Password Reset</h5>
				</CardHeader>
				<CardBody>
					<p>
						Removes all password reset links and provides a new one.<br /><b
							>Only use if you can verify the user's identity.</b
						>
					</p>
					<Button color="warning">Generate Link</Button>
				</CardBody>
			</Card>
		</Col>
		<Col md={6}>
			<Card class="mb-4">
				<CardHeader class="bg-secondary text-white">
					<h5 class="mb-0">User Notes</h5>
				</CardHeader>
				<CardBody>
					{#if notesError}
						<Alert color="danger">{notesError}</Alert>
					{/if}
					{#if newNoteMenuToggled}
						<Input
							type="textarea"
							placeholder="Add a note"
							disabled={notesBusy}
							bind:value={newNote}
							class="mb-2"
						/>
						<div class="d-flex justify-content-end mb-3">
							<Button
								color="primary"
								on:click={createNote}
								disabled={notesBusy}
							>
								Add
							</Button>
							<Button
								color="secondary"
								class="ms-2"
								on:click={() => (newNoteMenuToggled = false)}
								disabled={notesBusy}
							>
								Cancel
							</Button>
						</div>
					{:else}
						<Button color="primary" on:click={() => (newNoteMenuToggled = true)}
							><Icon name="plus-square" /></Button
						>
					{/if}
					<hr class="my-3" />
					{#if !user.modNotes || user.modNotes.length === 0}
						<Alert color="secondary" class="text-center mb-0">
							<Smile size="48" class="mb-2 text-success" /><br />
							No notes
						</Alert>
					{:else}
						{#each user.modNotes.slice().reverse() as note (note.id)}
							<Card class="mb-3">
								<CardHeader class="d-flex align-items-start">
									<Badge color="secondary" class="me-2">
										{new Date(note.createdAt).toLocaleString([], {
											year: "numeric",
											month: "2-digit",
											day: "2-digit",
											hour: "2-digit",
											minute: "2-digit",
										})}
									</Badge>

									<div class="d-flex align-items-center ms-auto gap-2">
										<Badge color="primary" class="align-self-center">
											<Icon name="person-fill" class="me-1" />
											{note.moderator.username}
										</Badge>
										<Badge color="info">
											<Icon name="info-circle-fill" class="me-1" />
											#{note.id}
										</Badge>

										<Dropdown>
											<DropdownToggle
												size="sm"
												class="bg-transparent"
												disabled={notesBusy}
											>
												<Icon name="caret-down-fill" class="text-secondary" />
											</DropdownToggle>
											<DropdownMenu>
												<DropdownItem on:click={() => deleteNote(note.id)}>
													Delete
												</DropdownItem>
											</DropdownMenu>
										</Dropdown>
									</div>
								</CardHeader>
								<CardBody>
									<div class="d-flex align-items-center gap-2">
										<div style="white-space: pre-wrap; flex: 1;">
											{note.note}
										</div>
									</div>
								</CardBody>
							</Card>
						{/each}
					{/if}
				</CardBody>
			</Card>
			<Card class="mb-4">
				<CardHeader class="bg-success text-white">
					<h5 class="mb-0">Update User</h5>
				</CardHeader>
				<CardBody>
					<p>
						<b>Note:</b> Use
						<a href="/cs/useradmin/adjust-assets?id={user.id}">Give or Take</a> to
						adjust Robux, Tickets, and Assets.
					</p>
					<hr class="my-2" />
					<div class="mb-3">
						<InputGroup>
							<InputGroupText>
								<Icon name="person"></Icon>
							</InputGroupText>
							<Input type="text" placeholder="Username" />
						</InputGroup>
						<InputGroup class="mt-3">
							<InputGroupText>
								<Icon name="key"></Icon>
							</InputGroupText>
							<Input type="text" placeholder="Password" />
						</InputGroup>
						<InputGroup class="mt-3">
							<InputGroupText>
								<Icon name="shield-lock"></Icon>
							</InputGroupText>
							<Input type="select" placeholder="Role Set">
								{#each Object.values(UserAdminTraitSafe) as role}
									<option value={role}>{role}</option>
								{/each}
							</Input>
						</InputGroup>
					</div>
					<Button color="success">Update</Button>
				</CardBody>
			</Card>
			<Card class="mb-4">
				<CardHeader class="bg-danger text-white">
					<h5 class="mb-0">Moderation History</h5>
				</CardHeader>
				<CardBody>
					<Table striped hover>
						<thead>
							<tr>
								<th>Action</th>
								<th>Created At</th>
								<th>Expires At</th>
								<th>Resolved</th>
								<th></th>
							</tr>
						</thead>
						<tbody>
							{#if user.moderation.length === 0}
								<tr>
									<td colspan="5" class="text-center text-muted">
										<Smile size="48" class="mb-2 text-success" /><br />
										This user has no moderation history
									</td>
								</tr>
							{:else}
								{#each paginatedModeration as mod}
									<tr
										onclick={() => toggleRow(mod.id)}
										style="cursor: pointer;"
									>
										<td>{mod.action}</td>
										<td>{new Date(mod.date).toLocaleString()}</td>
										<td
											>{mod.cannotReactivateUntil
												? new Date(mod.cannotReactivateUntil).toLocaleString()
												: "Never"}</td
										>
										<td>
											<ProtectedCheckbox checked={mod.resolved} />
										</td>
										<td>
											{expandedRows.has(mod.id) ? "▼" : "▶"}
										</td>
									</tr>
									{#if expandedRows.has(mod.id)}
										<tr>
											<td colspan="5">
												<div class="p-3">
													<p><strong>Reason:</strong> {mod.reason}</p>
													<p>
														<strong>Internal Notes:</strong>
														{mod.internalNotes || "None"}
													</p>
													<p>
														<strong>Resolved:</strong>
														{mod.resolved ? "Yes" : "No"}
													</p>
													<p class="text-muted small">ID: {mod.id}</p>
												</div>
											</td>
										</tr>
									{/if}
								{/each}
							{/if}
						</tbody>
					</Table>
					{#if totalPages > 1}
						<Pagination>
							<PaginationItem disabled={currentPage === 1}>
								<PaginationLink
									previous
									href="#"
									onclick={(e) => {
										e.preventDefault();
										currentPage--;
									}}
								/>
							</PaginationItem>
							{#each Array(totalPages) as _, i}
								<PaginationItem active={currentPage === i + 1}>
									<PaginationLink
										href="#"
										onclick={(e) => {
											e.preventDefault();
											currentPage = i + 1;
										}}
									>
										{i + 1}
									</PaginationLink>
								</PaginationItem>
							{/each}
							<PaginationItem disabled={currentPage === totalPages}>
								<PaginationLink
									next
									href="#"
									onclick={(e) => {
										e.preventDefault();
										currentPage++;
									}}
								/>
							</PaginationItem>
						</Pagination>
					{/if}
				</CardBody>
			</Card>
			<Card class="mb-4">
				<CardHeader class="bg-danger text-white">
					<h5 class="mb-0">Impersonate</h5>
				</CardHeader>
				<CardBody>
					<p>Literally logs you in as the user.</p>
					<hr class="my-2" />
					<Button color="danger">Impersonate User</Button>
				</CardBody>
			</Card>
		</Col>
	</Row>
</Container>
