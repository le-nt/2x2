<script lang="ts">
    const props = $props();
    let id = props.id as string;
    let className = props.className as string | null;
    let checked = props.checked as boolean | true;

    function preventCheckboxChange(event: Event) {
		event.preventDefault();
	}
</script>

<input type="checkbox" id={id} class={className} checked={checked} onclick={preventCheckboxChange} />