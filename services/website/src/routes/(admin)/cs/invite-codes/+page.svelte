<script lang="ts">
    import {
        Container, Input, InputGroup, InputGroupText,
        Button, Form, FormGroup, FormText, Icon, Alert, Table, Badge,
    } from "@sveltestrap/sveltestrap";
    import { setTitle } from "@client/stores";
    import { api } from "@client/api";

    setTitle("Beta Codes");

    let { data } = $props();
    const isTestWebsite = data.isTestWebsite;

    let quantity = $state(1);
    let searchQuery = $state("");
    let isProcessing = $state(false);
    let results = $state<any[]>([]); 
    let generatedLinks = $state<string[]>([]);
    let error = $state<string | null>(null);

    async function handleGenerate(e: Event) {
        e.preventDefault();
        isProcessing = true;
        error = null;
        generatedLinks = [];
        
        try {
            const response = await api.admin.users.invites.createBatch.put(fetch, {
                body: { count: quantity }
            });

            if (response.error) {
                error = response.error.value.error || "Failed to generate codes.";
            } else {
                results = response.data.invites;
                generatedLinks = response.data.links || [];
            }
        } catch (err: any) {
            error = err.message || "An unexpected error occurred.";
        } finally {
            isProcessing = false;
        }
    }

    async function handleSearch(e: Event) {
        e.preventDefault();
        isProcessing = true;
        error = null;
        generatedLinks = [];
        
        try {
            const response = await api.admin.users.invites.getInfo.get(fetch, {
                params: { code: searchQuery }
            });

            if (!response.error && response.data.invite) {
                results = [response.data.invite];
            } else {
                results = [];
                error = "Invite code not found.";
            }
        } catch (err: any) {
            error = "Search failed. Check your input.";
        } finally {
            isProcessing = false;
        }
    }

    async function copyToClipboard(text: string) {
        try {
            await navigator.clipboard.writeText(text);
            alert("Copied to clipboard!");
        } catch (err) {
            console.error("Failed to copy: ", err);
        }
    }

    function copyAllLinks() {
        if (generatedLinks.length > 0) {
            copyToClipboard(generatedLinks.join('\n'));
        }
    }

    const formatDate = (dateStr: string) => new Date(dateStr).toLocaleString();
</script>

<Container fluid class="mt-4">
    {#if !isTestWebsite}
        <Alert color="danger" fade={false}>
            <Icon name="exclamation-triangle-fill" class="me-2" />
            <strong>Access Denied:</strong> This tool is only available on Test Websites.
        </Alert>
    {:else}
        <div class="d-flex justify-content-between align-items-center mb-1">
            <h2 class="mb-0">Beta Codes</h2>
            
            {#if generatedLinks.length > 0}
                <Button color="outline-primary" size="sm" onclick={copyAllLinks}>
                    <Icon name="copy" class="me-1" /> Copy All Links ({generatedLinks.length})
                </Button>
            {/if}
        </div>
        <hr />

        {#if error}
            <Alert color="warning" dismissible toggle={() => error = null}>
                {error}
            </Alert>
        {/if}

        <div class="row">
            <div class="col-md-5">
                <Form onsubmit={handleGenerate}>
                    <FormGroup>
                        <h5 class="mb-3">Generate Codes</h5>
                        <InputGroup>
                            <InputGroupText>Quantity</InputGroupText>
                            <Input type="number" min="1" max="20" bind:value={quantity} disabled={isProcessing} />
                            <Button color="success" type="submit" disabled={isProcessing}>
                                {isProcessing ? "Processing..." : "Generate"}
                            </Button>
                        </InputGroup>
                        <FormText>Batch limit: 20 codes per request.</FormText>
                    </FormGroup>
                </Form>
            </div>

            <div class="col-md-7">
                <Form onsubmit={handleSearch}>
                    <FormGroup>
                        <h5 class="mb-3">Find Existing Code</h5>
                        <InputGroup>
                            <Input placeholder="Enter code (e.g. roblox_238...)" bind:value={searchQuery} disabled={isProcessing} />
                            <Button color="primary" type="submit" disabled={isProcessing || !searchQuery}>
                                <Icon name="search" />
                            </Button>
                        </InputGroup>
                    </FormGroup>
                </Form>
            </div>
        </div>

        <hr class="my-4" />

        <div class="results-container">
            {#if results.length > 0}
                <Table striped hover responsive class="align-middle">
                    <thead>
                        <tr>
                            <th>Code / Link</th>
                            <th>Status</th>
                            <th>Created</th>
                            <th>Used By</th>
                        </tr>
                    </thead>
                    <tbody>
                        {#each results as invite}
                            <tr>
                                <td>
                                    <div class="fw-bold">{invite.code}</div>
                                    {#if invite.link}
                                        <div class="d-flex align-items-center mt-1">
                                            <Button 
                                                color="link" 
                                                class="p-0 me-2 text-decoration-none" 
                                                onclick={() => copyToClipboard(invite.link)}
                                                title="Copy Link"
                                            >
                                                <Icon name="clipboard" />
                                            </Button>
                                            <small class="text-muted text-break">{invite.link}</small>
                                        </div>
                                    {/if}
                                </td>
                                <td>
                                    {#if invite.used}
                                        <Badge color="secondary">Used</Badge>
                                    {:else}
                                        <Badge color="success">Active</Badge>
                                    {/if}
                                </td>
                                <td><small>{formatDate(invite.createdAt)}</small></td>
                                <td>
                                    {#if invite.usedBy}
                                        <a href={`/cs/useradmin/summary?id=${invite.usedBy}`} rel="noopener noreferrer external" target="_blank">
                                            <i>#{invite.usedBy}</i>
                                        </a>
                                    {:else}
                                        <i>N/A</i>
                                    {/if}
                                </td>
                            </tr>
                        {/each}
                    </tbody>
                </Table>
            {:else if !isProcessing}
                <div class="text-center py-5 bg-secondary-subtle text-muted rounded border">
                    <Icon name="inbox" style="font-size: 2rem;" />
                    <p class="mt-2">No active searches or results to display</p>
                </div>
            {/if}
        </div>
    {/if}
</Container>

<style>
    .results-container {
        min-height: 200px;
    }
</style>