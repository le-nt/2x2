<script lang="ts">
    import { goto, invalidateAll } from "$app/navigation";
    import { page } from "$app/stores";
    import { api } from "@client/api";
    import { formatTrait } from "@client/traits";
	import { error } from "@sveltejs/kit";
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
        ButtonGroup,
        FormGroup
    } from "@sveltestrap/sveltestrap";
    import { setTitle } from "@client/stores";
    setTitle("2FA");

    let { data } = $props();
    let failure = $state("");
    let success = $state(false);
    let code = $state("");
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

        const request = await api.admin.totp.enroll.post(fetch, { body: { code } });
        if (request.error) {
            failure = `${request.error.value.error}: ${request.error.value.message}`;
            return;
        }

        success = true;
    }

    if (data === null || !(data as any).qr || !(data as any).secret) {
        failure = "Failed to load enrollment data. Try refreshing the page?";
    }
</script>

<Container class="py-5">
    <Row class="justify-content-center">
        <Col md="6" lg="5">
            {#if failure}
                <Card class="mb-4 border-danger">
                    <CardHeader class="bg-danger text-white">Error</CardHeader>
                    <CardBody>
                        <p>{failure}</p>
                        <Button color="danger" onclick={() => failure = ""}>Dismiss</Button>
                    </CardBody>
                </Card>
            {:else if success}
                <Card class="mb-4 border-success">
                    <CardHeader class="bg-success text-white">Enrollment Successful</CardHeader>
                    <CardBody>
                        <p>In future, you will use your authenticator to log into the panel.</p>
                        <Button color="success" onclick={() => goto(getReturnUrl(), {
                            invalidateAll: true
                        })}>Proceed</Button>
                    </CardBody>
                </Card>
            {:else}
                <Card class="shadow-sm">
                    <CardHeader class="bg-primary border-primary text-white">
                        <h5 class="mb-0">2FA Enrollment</h5>
                    </CardHeader>
                    <CardBody>
                        <p class="text-muted mb-4">
                            Welcome new <strong>{formatTrait(data.user.roleSet)}</strong>! <br/>
                            Please scan the QR code below with your authenticator app. <br/>
                            Don't lose this — it's required to log into the moderation portal.
                        </p>

                        <div class="text-center mb-4">
                            <img src={data.qr} alt="QR Code" class="img-fluid mb-3" style="max-width: 200px;" />
                            <p class="small text-muted mb-1">Or use the secret key:</p>
                            <code class="d-block mb-3 bg-light p-2 rounded">{data.secret}</code>
                            
                            <div class="d-flex justify-content-center gap-2">
                                <ButtonGroup>
                                <Button
                                    color="secondary"
                                    size="md"
                                    onclick={() => {
                                        navigator.clipboard.writeText(data.secret);
                                        alert("Copied to clipboard!");
                                    }}
                                >
                                    Copy Secret
                                </Button>
                                <Button color="danger" size="md" onclick={() => invalidateAll()}>
                                    Reroll
                                </Button>
                                </ButtonGroup>
                            </div>
                        </div>

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
                                    feedback="Please enter a valid 6-digit code."
                                    required
                                    on:input={(e) => {
                                        code = (e.target as HTMLInputElement).value.replace(/[^0-9]/g, "").slice(0, 6);
                                    }}
                                />
                            </FormGroup>
                            <Button type="submit" color="primary" block class="w-100" onclick={() => validated = true}>
                                Verify & Enroll
                            </Button>
                        </Form>
                    </CardBody>
                </Card>
            {/if}
        </Col>
    </Row>
</Container>
