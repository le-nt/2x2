<script lang="ts">
	interface Props {
		type?: "control" | "primary" | "neutral" | "negative";
		size: "small" | "medium" | "large";
		text: string;
		href?: string;
        class?: string;
        submit?: boolean;
		onclick?: any;
	}

	const {
        type = "neutral",
        size,
        text,
        href,
        class: additionalClasses = '',
        submit,
        ...rest
    }: Props = $props();

	const buttonClass = $derived(
		type === 'control'
			? `btn-control btn-control-${size} ` + additionalClasses
			: `btn-${size} btn-${type} ` + additionalClasses
	);
</script>

{#if href}
	<a href={href} class={buttonClass} {...rest}>
		{text}
	</a>
{:else}
	<button type={submit ? "submit" : "button"} class={buttonClass} {...rest}>
		{text}
	</button>
{/if}

<style>
    a.btn-medium {
        line-height: 28px;
    }

	.btn-control,
	.btn-control:active,
	.btn-control:link,
	.btn-control:visited,
	.btn-control:hover {
		border: 1px solid #777;
		padding: 0 6px;
		color: #000;
		text-decoration: none;
		background-color: #ccc;
		text-align: center;
		font-weight: normal;
		cursor: pointer;
		background-position: top;
		display: inline-block;
	}

	.btn-control:hover {
		background-position: bottom;
		border-color: #888;
		text-decoration: none;
	}

	.btn-control.disabled {
		border: 1px solid #ccc;
		cursor: default;
		color: #a7a7a7;
		background-position: center;
	}

	.btn-control.btn-control-small {
		height: 18px;
		line-height: 18px;
		font-size: 11px;
		background-image: url(/images/btn/control-small-tile.png);
	}

	.btn-control.btn-control-medium {
		height: 21px;
		line-height: 21px;
		font-size: 12px;
		background-image: url(/images/btn/control-medium-tile.png);
	}

	.btn-control.btn-control-large {
		height: 25px;
		line-height: 24px;
		font-size: 13px;
		padding: 0 7px;
		background-image: url(/images/btn/control-large-tile.png);
	}

	a.btn-control.top-level {
		font-weight: bold;
	}

	a.btn-large, button.btn-large,
	a.btn-medium, button.btn-medium,
	a.btn-small, button.btn-small {
		display: inline-block;
		text-align: center;
		font-weight: normal;
		text-decoration: none;
		border-width: 1px;
		border-style: solid;
		cursor: pointer;
	}

	a.btn-large, button.btn-large {
		padding: 9px 13px 0 13px;
		height: 39px;
		min-width: 70px;
		font-size: 23px;
		line-height: 27px;
		background-position: left 0;
	}

	a.btn-large:hover, button.btn-large:hover,
	a.btn-medium:hover, button.btn-medium:hover,
	a.btn-small:hover, button.btn-small:hover {
		text-decoration: none;
	}

	a.btn-large:hover, button.btn-large:hover {
		background-position: left -48px;
	}

	a.btn-medium, button.btn-medium {
		padding: 1px 13px 3px 13px;
		height: 28px;
		min-width: 62px;
		font-size: 20px;
		background-position: left -96px;
	}

	a.btn-medium:hover, button.btn-medium:hover {
		background-position: left -128px;
	}

	a.btn-small, button.btn-small {
		padding: 1px 7px 0 7px;
		height: 20px;
		min-width: 40px;
		font-size: 14px;
		line-height: 18px;
		background-position: left -160px;
	}

	a.btn-small:hover, button.btn-small:hover {
		background-position: left -181px;
	}

	.btn-primary,
	a.btn-primary:link,
	a.btn-primary:active,
	a.btn-primary:visited {
		border-color: #007001;
		background-color: #007001;
		background-image: url(/images/btn/bg-green.png);
		color: white;
	}

	.btn-neutral,
	a.btn-neutral:link,
	a.btn-neutral:active,
	a.btn-neutral:visited {
		border-color: #0852b7;
		background-color: #0852b7;
		background-image: url(/images/btn/bg-blue.png);
		color: white;
	}

	.btn-negative,
	a.btn-negative:link,
	a.btn-negative:active,
	a.btn-negative:visited {
		border-color: #565656;
		background-color: #565656;
		background-image: url(/images/btn/bg-gray.png);
		color: white;
	}

	.btn-disabled-primary,
	.btn-disabled-primary:hover,
	.btn-disabled-neutral,
	.btn-disabled-neutral:hover,
	.btn-disabled-negative,
	.btn-disabled-negative:hover {
		cursor: default;
		background-position: left -202px;
	}

	.btn-disabled-primary,
	.btn-disabled-primary:link,
	.btn-disabled-primary:active,
	.btn-disabled-primary:visited {
		background-color: #99c699;
		background-image: url(/images/btn/bg-green.png);
		border-color: #99c699;
		color: white;
	}

	.btn-disabled-neutral,
	.btn-disabled-neutral:link,
	.btn-disabled-neutral:active,
	.btn-disabled-neutral:visited {
		background-color: #9cbae2;
		background-image: url(/images/btn/bg-blue.png);
		border-color: #9cbae2;
		color: white;
	}

	.btn-none {
		display: none;
	}

	.btn-disabled-negative,
	.btn-disabled-negative:link,
	.btn-disabled-negative:active,
	.btn-disabled-negative:visited {
		background-color: #bbbcbb;
		background-image: url(/images/btn/bg-gray.png);
		border-color: #bbbcbb;
		color: white;
	}
</style>