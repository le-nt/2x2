<script lang="ts">
	import Thumbnail from "@components/Thumbnail.svelte";
	import { ThumbnailType } from "@/types/thumb";
	import { api } from "@client/api";
	import { goto } from "$app/navigation";
	import { setTitle } from "@client/stores";
    import { Container, Card, CardBody, Button, Alert, Badge } from "@sveltestrap/sveltestrap";

	setTitle("Review Abuse");

	let { data } = $props();
	let thread = data.thread;
	if (!thread) {
		goto("/Forum/Default.aspx");
	}

	let username = thread.user.username;
	let userId = thread.user.id;
	let forum = thread.forum.name;
	let forumId = thread.forum.id;

	let content = thread.content;
	let hidden = $state(thread.hidden);
	let createdAtNotParsed = thread.createdAt;
	let createdAt = new Date(createdAtNotParsed).toLocaleString();
	
	async function toggleVisibility() {
		const res = await api.admin.forum.getThread.delete(fetch, {
			body: {
				threadId: thread.id
			}
		});
		if (res.data) {
			hidden = !hidden;
		} else {
			alert("Failed to toggle visibility");
		}
	}
</script>

<Container fluid class="mt-4">
	<h2 class="mb-4">Moderate Thread</h2>
    <hr />

    <Alert color="warning">
        <h4 class="alert-heading">Warning</h4>
        <p class="mb-0">You should Escalate Report for any abusive content.</p>
    </Alert>

    <Alert color="info">
        <h4 class="alert-heading">Hold up!</h4>
        <p class="mb-0">Toggling visibility on Threads will make the entire conversation invisible to all users. You have been warned!</p>
    </Alert>

	<Card>
        <CardBody>
            <div class="d-flex align-items-start gap-3">
                <div class="flex-shrink-0" style="width: 100px; height: 100px;">
                    <Thumbnail
                        id={userId}
                        type={ThumbnailType.Avatar}
                        class="w-100 h-100 rounded object-fit-cover"
                        height={100}
                        width={100}
                    />
                </div>
                <div class="flex-grow-1 min-w-0">
                    <div class="d-flex flex-wrap align-items-center gap-2">
                        <h4 class="mb-0 text-truncate">{username}</h4>
                        <Badge color={hidden ? "danger" : "success"}>
                            {hidden ? "Hidden" : "Live"}
                        </Badge>
                        <span class="small text-muted">•</span>
                        <span class="small text-muted">Posted {createdAt}</span>
                    </div>
                    <div class="small text-muted mt-1">
                        In <a href={`/Forum/ShowForum.aspx?ForumID=${forumId}`} class="text-decoration-none">{forum}</a>
                    </div>
                </div>
                <div class="d-none d-md-flex gap-2">
                    <Button color="secondary" onclick={() => window.history.back()}>Back</Button>
                    <Button color="danger" onclick={toggleVisibility}>Toggle Visibility</Button>
                </div>
            </div>

            <div class="mt-4">
                <p class="text-break" style="white-space: pre-wrap;">{content}</p>
            </div>

            <div class="mt-4 d-md-none">
                <Button color="danger" block onclick={toggleVisibility}>Toggle Visibility</Button>
            </div>
        </CardBody>
	</Card>
</Container>
