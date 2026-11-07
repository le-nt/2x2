<script lang="ts">
	import Thumbnail from "@components/Thumbnail.svelte";
	import { ThumbnailType } from "@/types/thumb";
	import { api } from "@client/api";
	import { setTitle } from "@client/stores";
    import { Container, Card, CardBody, Button, Alert, Badge } from "@sveltestrap/sveltestrap";

	setTitle("Review Abuse");

	let { data } = $props();
	let post = data.post;

	let username = post.user.username;
	let userId = post.user.id;
	let forum = post.forum.name;
	let forumId = post.forum.id;

	let content = post.content;
	let hidden = $state(post.hidden);
	let createdAtNotParsed = post.createdAt;
	let createdAt = new Date(createdAtNotParsed).toLocaleString();

	async function toggleVisibility() {
		const res = await api.admin.forum.getPost.delete(fetch, {
			body: {
				postId: post.id,
			},
		});
		if (res.data) {
			hidden = !hidden;
		} else {
			alert("Failed to toggle visibility");
		}
	}
</script>

<Container fluid class="mt-4">
	<h2 class="mb-4">Moderate Post</h2>
    <hr />

    <Alert color="warning">
        <h4 class="alert-heading">Hold up!</h4>
        <p class="mb-0">If in doubt, escalate to a Moderator or above for a ban.</p>
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
