<script lang="ts">
    let { status } = $props(); // TODO: proper typing
    import { Badge, Icon } from "@sveltestrap/sveltestrap";
    import { AccountStatus } from "@/types/roblox";
</script>


{#if status === AccountStatus.Ok}
    <Badge color="success">
        <Icon name="check-circle-fill" class="me-1" />
        OK
    </Badge>
{:else if status === AccountStatus.Suppressed}
    <Badge color="warning">
        <Icon name="exclamation-triangle-fill" class="me-1" />
        Suppressed
    </Badge>
{:else if status === AccountStatus.Deleted}
    <Badge color="danger">
        <Icon name="trash-fill" class="me-1" />
        Deleted
    </Badge>
{:else if status === AccountStatus.GdprDeleted}
    <Badge color="info">
        <Icon name="trash-fill" class="me-1" />
        GdprDeleted
    </Badge>
{:else}
    <script lang="ts">
        alert("Unknown status: " + status.toString() + " in UserStatusBadge");
    </script>
{/if}