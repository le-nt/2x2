<script lang="ts">
	import Header from "./Header.svelte";
	import Footer from "@components/layout/Footer.svelte";
	import RollerCoaster from "./main/RollerCoaster.svelte";
	import "./landing.css"
	
	let { data } = $props()
	let isTestWebsite = data.isTestWebsite;
	let signUpEnabled = data.features.find(f => f.key === "signUpEnabled")?.enabled;
	let baseUrl = data.baseUrl;
	// console.log(data.baseUrl);
</script>

<svelte:head>
	<meta charset="UTF-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1.0" />
	<meta content="2x2" property="og:title" />
	<meta
		content="Near 1:1 recreation of ROBLOX from March 2016, with all the magic happening securely in your browser. No invite keys, no applications, no bullshit."
		property="og:description"
	/>
	<meta content="/images/prpizza-brand/prpizza-transparent-bg.png" property="og:image" />
	<meta content={baseUrl} property="og:url" />
	<meta content="#f4900c" data-react-helmet="true" name="theme-color" />
</svelte:head>

<Header captchaKey={data.captchaKey} />

<div class="content">
	<RollerCoaster isTestWebsite={isTestWebsite} signUpEnabled={signUpEnabled} captchaKey={data.captchaKey} inviteAutofill={data.inviteAutofill} />
</div>

<Footer />

<style>
	.content {
		margin: 0 auto;
		margin-bottom: 40px;
		height: 100%;
	}
</style>