<script lang="ts">
    import { api } from "@client/api";
    import { goto } from "$app/navigation";
    import { page } from "$app/stores";
    import {
        Container,
        Row,
        Col,
        Card,
        CardHeader,
        CardBody,
        Button,
        Form,
        Input,
        FormGroup
    } from "@sveltestrap/sveltestrap";
    import { setTitle } from "@client/stores";
    setTitle("Sign In");

    let code = $state("");
    let failure = $state("");
    let success = $state(false);
    let validated = $state(false);

    function getReturnUrl() {
        const returnUrl = $page.url.searchParams.get('returnUrl');
        if (!returnUrl || returnUrl.startsWith('http://') || returnUrl.startsWith('https://') || returnUrl.startsWith('//')) {
            return '/cs';
        }
        return returnUrl.startsWith('/') ? returnUrl : '/cs';
    }

    async function handleSubmit(event?: Event) {
        if (event) event.preventDefault();

        validated = true;
        code = code.replace(/[^0-9]/g, "").slice(0, 6);

        const request = await api.admin.totp.validate.post(fetch, {
            body: { code },
        });

        if (request.error) {
            failure = `${request.error.value.error}: ${request.error.value.message}`;
            return;
        }

        if (request.data && request.data.success) {
            success = true;
            window.location.href = getReturnUrl();
        }
    }
</script>

<Container class="py-5">
    <Row class="justify-content-center">
        <Col md="6" lg="4">
            {#if failure}
                <Card class="mb-4 border-danger">
                    <CardHeader class="bg-danger text-white">Error</CardHeader>
                    <CardBody>
                        <p class="text-center mb-3">{failure}</p>
                        <Button color="danger" block class="w-100" onclick={() => failure = ""}>Dismiss</Button>
                    </CardBody>
                </Card>
            {:else if success}
                <Card class="mb-4 border-success">
                    <CardHeader class="bg-success text-white">Login Successful</CardHeader>
                    <CardBody>
                        <p class="text-center mb-3">Redirecting you...
                            If this fails, click the button below.
                        </p>
                        <Button color="success" block class="w-100" onclick={() => window.location.href = getReturnUrl()}>Proceed</Button>
                    </CardBody>
                </Card>
            {:else}
                <Card class="shadow-sm border-primary">
                    <CardHeader class="bg-primary text-white text-center">
                        <h5 class="mb-0">Log In</h5>
                    </CardHeader>
                    <CardBody>
                        <p class="text-muted text-center mb-4">
                            To continue, enter the 6-digit code from your authenticator app.
                        </p>

                        <Form {validated} onsubmit={handleSubmit}>
                            <FormGroup>
                                <Input
                                    type="text"
                                    placeholder="000000"
                                    bind:value={code}
                                    inputmode="numeric"
                                    autocomplete="one-time-code"
                                    minlength={6}
                                    maxlength={6}
                                    class="text-center form-control-lg"
                                    style="letter-spacing: 0.5em; font-size: 1.5rem;"
                                    autofocus
                                    feedback="Please enter a valid 6-digit code."
                                    required
                                    on:input={(e) => {
                                        code = (e.target as HTMLInputElement).value.replace(/[^0-9]/g, "").slice(0, 6);
                                    }}
                                />
                            </FormGroup>
                            <Button type="submit" color="primary" block class="w-100" onclick={() => validated = true}>
                                Verify
                            </Button>
                        </Form>
                    </CardBody>
                </Card>
            {/if}
        </Col>
    </Row>
</Container>
