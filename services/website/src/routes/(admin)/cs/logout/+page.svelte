<script lang="ts">
	import {
		Card,
		CardBody,
		CardTitle,
		CardText,
		CardHeader,
		Container,
        Button
	} from "@sveltestrap/sveltestrap";
</script>

<Container class="my-5">
	<Card>
		<CardHeader class="bg-primary text-white"> 
			<CardTitle>Success</CardTitle>
		</CardHeader>
		<CardBody>
			<CardText>
                You're now logged out of CS.
			</CardText>
            <Button href="/home" color="primary" rel="external">Back to ROBLOX</Button>
		</CardBody>
	</Card>
</Container>
