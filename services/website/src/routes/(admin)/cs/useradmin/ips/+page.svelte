<script lang="ts">
	import ProtectedCheckbox from "@components/admin_newdesign/ProtectedCheckbox.svelte";
    import { Container, Table } from "@sveltestrap/sveltestrap";
	import { FlagIcon, Check } from "lucide-svelte";
    const { data } = $props();
    const { ips, user } = data;
</script>

<Container fluid class="mt-3">
    <h2 class="mb-2">IP Addresses</h2>
	<span class="text-muted"
		>{user.username}
		<a rel="external" target="_blank" href={`/users/${user.id}/profile`}
			>profile</a
		> • <a rel="external" href={`/cs/useradmin/summary?id=${user.id}`}>summary</a></span
	>
    <hr />
    <Table striped bordered hover responsive>
        <thead>
            <tr>
                <th>IP Address</th>
                <th>Last Seen</th>
                <th>Status</th>
                <th>Banned?</th>
                <th>Action</th>
            </tr>
        </thead>
        <tbody>
            {#each ips as ip}
                <tr>
                    <td>{ip.content}</td>
                    <td>{new Date(ip.lastSeen).toLocaleString()}</td>
                    <td>
                        {#if ip["_count"].users > 1}
                            <span class="d-inline-flex align-items-center px-2 py-1 rounded bg-danger text-white">
                                <FlagIcon class="me-1" size="16" />
                                <span>
                                    <strong>Flagged:</strong> {ip["_count"].users - 1} alt{ip["_count"].users - 1 === 1 ? '' : 's'}
                                </span>
                            </span>
                        {:else}
                            <span class="d-inline-flex align-items-center px-2 py-1 rounded bg-success text-white">
                                <Check class="me-1" size="16" />
                                OK
                            </span>
                        {/if}
                    </td>
                    <td>
                        <ProtectedCheckbox checked={ip.banned} />
                    </td>
                    <td>
                        <a href={`#`}>Manage</a>
                    </td>
                </tr>
            {/each}
        </tbody>
    </Table>
</Container>