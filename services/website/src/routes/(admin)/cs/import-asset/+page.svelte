<script lang="ts">
	import {
		Container,
		Input,
		InputGroup,
		InputGroupText,
        Button,
        Alert,
        Form,
        FormGroup,
        FormText,
        Icon
	} from "@sveltestrap/sveltestrap";
	import { setTitle } from "@client/stores";
	setTitle("Import");

    function preventNotNumbers(event: InputEvent) {
        const input = event.target as HTMLInputElement;
        input.value = input.value.replace(/[^0-9]/g, "");}
</script>

<Container fluid class="mt-4">
    <h2 class="mb-1">Import Asset</h2>
    <hr />
    <!-- <Alert color="danger">
        Can't import this Asset. It's a <b>Place</b>
    </Alert> -->
    <span class="mb-3 d-block text-muted">
        This isn't where you find and modify assets! To do that, go to <a href="/cs/find/asset">Find Asset</a>.
    </span>
    <Form>
        <FormGroup>
            <InputGroup>
                <InputGroupText>
                    <Icon name="box-seam" />
                </InputGroupText>
                <Input type="text" placeholder="AssetID on ROBLOX.com" on:input={preventNotNumbers} />
            </InputGroup>
        <FormText>
            e.g for <code>https://www.roblox.com/catalog/123456789/hi</code>, the AssetID is <code>123456789</code>.
        </FormText>
        </FormGroup>
        <Button color="primary" type="submit">Import</Button>
    </Form>
</Container>
