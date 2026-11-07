<script lang="ts">
	import { api } from "@client/api";
	import { goto } from "$app/navigation";
    import { Container, Card, CardBody, Button, Form, FormGroup, Input, Label } from "@sveltestrap/sveltestrap";
    import { setTitle } from "@client/stores";

    setTitle("Add New Node");
	
	let nodeName = $state("");
	let nodeIP = $state("");
	let nodePort = $state("");
	let useSSL = $state(false);
	let canDoGameserver = $state(false);
	let canDoRendering = $state(false);

	async function handleSubmit(e: Event) {
        e.preventDefault();
		const data = { nodeName, nodeIP, nodePort, useSSL, canDoGameserver, canDoRendering };
		console.log("Submitting new node data:", data);
		const res = await api.admin.arbiter.create.post(fetch, {
			body: {
				nodeName: nodeName,
				nodeUri: nodeIP,
				tls: useSSL,
				nodePort: nodePort,
				gameserver: canDoGameserver,
				renderer: canDoRendering
			}
		});
		if (res.error) {
			console.log("there is an error sooo")
			console.log(res.error.value.message);
			goto(`/cs/infra/machines?error=Failure to add node: ${res.error.value.message}`);
			return;
		}
		if (res.data) {
			console.log("ok")
			goto(`/cs/infra/machines?success`);
			return;
		} else {
			console.log("unknown error");
			goto(`/cs/infra/machines?error`);
			return;
		}
	}
</script>

<Container fluid class="mt-4">
    <div class="d-flex justify-content-between align-items-center mb-4">
        <h2 class="mb-0">Add New Node</h2>
    </div>

    <Card color="secondary-subtle" class="mb-4">
        <CardBody>
            <Form onsubmit={handleSubmit}>
                <FormGroup>
                    <Label for="nodeName">Node Name</Label>
                    <Input
                        type="text"
                        id="nodeName"
                        placeholder="Enter node name"
                        required
                        bind:value={nodeName}
                    />
                </FormGroup>

                <FormGroup>
                    <Label for="nodeIP">IP/URL</Label>
                    <Input
                        type="text"
                        id="nodeIP"
                        placeholder="Enter IP or URL"
                        required
                        bind:value={nodeIP}
                    />
                </FormGroup>

                <FormGroup>
                    <Label for="nodePort">Port</Label>
                    <Input
                        type="number"
                        id="nodePort"
                        placeholder="Enter port number"
                        required
                        bind:value={nodePort}
                        min="1"
                        max="65535"
                    />
                </FormGroup>

                <FormGroup check class="mb-2">
                    <Input type="checkbox" id="useSSL" bind:checked={useSSL} />
                    <Label check for="useSSL">Use SSL/TLS</Label>
                </FormGroup>

                <FormGroup check class="mb-2">
                    <Input type="checkbox" id="canDoGameserver" bind:checked={canDoGameserver} />
                    <Label check for="canDoGameserver">Can host gameservers</Label>
                </FormGroup>

                <FormGroup check class="mb-4">
                    <Input type="checkbox" id="canDoRendering" bind:checked={canDoRendering} />
                    <Label check for="canDoRendering">Can render thumbnails</Label>
                </FormGroup>

                <Button color="primary" type="submit">Create Node</Button>
            </Form>
        </CardBody>
    </Card>
</Container>
