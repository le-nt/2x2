<script lang="ts">
	import ProtectedCheckbox from "@components/admin_newdesign/ProtectedCheckbox.svelte";
	import UserStatusBadge from "@components/admin_newdesign/UserStatusBadge.svelte";
	import {
		Container,
		Input,
		InputGroup,
		InputGroupText,
		Icon,
		Button,
		ButtonGroup,
		Table,
		Alert,
		Pagination,
		PaginationItem,
		PaginationLink,
		Dropdown,
		DropdownItem,
		DropdownMenu,
		DropdownToggle,
	} from "@sveltestrap/sveltestrap";
	import { api } from "@client/api";
	import { setTitle } from "@client/stores";
	import { UserRound } from "lucide-svelte";
	setTitle("Find");

	let query = $state("");
	let activeSearch = $state("");
	let results = $state<any[]>([]);
	let error = $state("");

	let currentPage = $state(1);
	let totalPages = $state(1);
	let pageSize = $state(10);

	function setPageSize(size: number) {
		pageSize = size;
		if (activeSearch) {
			search(activeSearch, 1);
		}
	}

	async function search(type: string, page = 1) {
		activeSearch = type;
		currentPage = page;
		error = "";
		results = [];

		if (!query && type !== "Show All Users") {
			error = "Please enter a search query";
			return;
		}

		if (type === "Show All Users") {
			const res = await api.admin.users.list.post(fetch, {
				body: {
					page: page,
					limit: pageSize,
				},
			});
			if (res.error) {
				error = res.data.error;
				return;
			}
			if (res.data.success) {
				results = res.data.data;
				if (res.data.pagination) {
					totalPages = res.data.pagination.totalPages;
				} else {
					totalPages = 1;
				}
			} else {
				error = res.data.error || "Unknown error";
			}
		} else if (type === "ID") {
			if (isNaN(Number(query))) {
				error = "User ID must be a number";
				return;
			}
			const res = await api.admin.users.byId.post(fetch, {
				body: { userId: query },
			});
			if (res.error) {
				error = res.data.error;
				return;
			}
			if (res.data.success) {
				results = res.data.data;
				totalPages = 1;
			} else {
				error = res.data.error || "Unknown error";
			}
		} else if (type === "Username") {
			const res = await api.admin.users.byUsername.post(fetch, {
				body: {
					username: query,
					page: page,
					limit: pageSize,
				},
			});
			if (res.error) {
				error = res.data.error;
				return;
			}
			if (res.data.success) {
				results = res.data.data;
				if (res.data.pagination) {
					totalPages = res.data.pagination.totalPages;
				} else {
					totalPages = 1;
				}
			} else {
				error = res.data.error || "Unknown error";
			}
		} else if (type === "IP Address") {
			const res = await api.admin.users.byIp.post(fetch, {
				body: {
					ip: query,
					page: page,
					limit: pageSize,
				},
			});
			if (res.error) {
				error = res.data.error;
				return;
			}
			if (res.data.success) {
				results = res.data.data;
				if (res.data.pagination) {
					totalPages = res.data.pagination.totalPages;
				} else {
					totalPages = 1;
				}
			} else {
				error = res.data.error || "Unknown error";
			}
		} else if (type === "PII ID") {
			const res = await api.admin.users.byPiiId.post(fetch, {
				body: {
					piiId: query,
					page: page,
					limit: pageSize,
				},
			});
			if (res.error) {
				error = res.data.error;
				return;
			}
			if (res.data.success) {
				results = res.data.data;
				if (res.data.pagination) {	
					totalPages = res.data.pagination.totalPages;
				} else {
					totalPages = 1;
				}
			} else {	
				error = res.data.error || "Unknown error";
			}
		} else if (type === "") {
			error = "Unknown error";
		} else {
			error = `Search type "${type}" not implemented yet`;
		}
	}
</script>

<Container fluid class="mt-4">
	<h2 class="mb-2">Find User</h2>
	<hr />

	{#if error}
		<Alert color="danger">{error}</Alert>
	{/if}

	<form
		onsubmit={(e) => {
			e.preventDefault();
			search(activeSearch);
		}}
	>
		<InputGroup>
			<InputGroupText><Icon name="search" /></InputGroupText>
			<Input type="text" placeholder="Search..." bind:value={query} />
		</InputGroup>
		<div class="d-flex mt-3 gap-2">
			<ButtonGroup>
				<Button
					active={activeSearch === "Username"}
					color="primary"
					onclick={() => search("Username")}>Username</Button
				>
				<Button
					active={activeSearch === "ID"}
					color="primary"
					onclick={() => search("ID")}>ID</Button
				>
				<Button
					active={activeSearch === "IP Address"}
					color="primary"
					onclick={() => search("IP Address")}>IP Address</Button
				>
				<Button
					active={activeSearch === "PII ID"}
					color="primary"
					onclick={() => search("PII ID")}>PII ID</Button
				>
			</ButtonGroup>
			<Button
					active={activeSearch === "Show All Users"}
					color="info"
					onclick={() => search("Show All Users")}>Show All Users</Button
				>
			<Dropdown>
				<DropdownToggle caret>
					{pageSize} / page
				</DropdownToggle>
				<DropdownMenu>
					<DropdownItem onclick={() => setPageSize(10)}>10</DropdownItem>
					<DropdownItem onclick={() => setPageSize(25)}>25</DropdownItem>
					<DropdownItem onclick={() => setPageSize(50)}>50</DropdownItem>
					<DropdownItem onclick={() => setPageSize(100)}>100</DropdownItem>
				</DropdownMenu>
			</Dropdown>
		</div>
	</form>
	<div class="mt-4">
		<Table responsive bordered striped>
			<thead>
				<tr>
					<th>#</th>
					<th>Username</th>
					<th>RoleSet</th>
					<th>Creation Date</th>
					<th>Last Login</th>
					<th>Approved</th>
					<th>Moderation Status</th>
				</tr>
			</thead>
			<tbody>
				{#each results as user}
					<tr>
						<td>{user.id}</td>
						<td
							><a href="/cs/useradmin/summary?id={user.id}">{user.username}</a
							></td
						>
						<td>{user.roleSet}</td>
						<td>{new Date(user.createdAt).toLocaleDateString()}</td>
						<td>{new Date(user.lastLogin).toLocaleDateString()}</td>
						<td>
							<ProtectedCheckbox checked={user.approved} />
						</td>
						<td>
							<UserStatusBadge status={user.status} />
						</td>
					</tr>
				{/each}
			</tbody>
		</Table>
	</div>

	<div class="d-flex justify-content-center mt-3">
		<Pagination aria-label="Page navigation">
			<PaginationItem disabled={currentPage === 1}>
				<PaginationLink first onclick={() => search(activeSearch, 1)} />
			</PaginationItem>
			<PaginationItem disabled={currentPage === 1}>
				<PaginationLink
					previous
					onclick={() => search(activeSearch, currentPage - 1)}
				/>
			</PaginationItem>

			{#each Array(totalPages) as _, i}
				{#if i + 1 >= currentPage - 2 && i + 1 <= currentPage + 2}
					<PaginationItem active={currentPage === i + 1}>
						<PaginationLink onclick={() => search(activeSearch, i + 1)}>
							{i + 1}
						</PaginationLink>
					</PaginationItem>
				{/if}
			{/each}

			<PaginationItem disabled={currentPage === totalPages}>
				<PaginationLink
					next
					onclick={() => search(activeSearch, currentPage + 1)}
				/>
			</PaginationItem>
			<PaginationItem disabled={currentPage === totalPages}>
				<PaginationLink last onclick={() => search(activeSearch, totalPages)} />
			</PaginationItem>
		</Pagination>
	</div>
</Container>
