<script lang="ts">
    import { goto } from "$app/navigation";
    import { api } from "@client/api";
    import { loginError } from "@client/stores";
	import { onMount } from "svelte";
    import { Turnstile } from "svelte-turnstile";

	let navbar: HTMLDivElement | null = null;

	let { captchaKey } = $props();
	let username = $state("");
	let password = $state("");
	let captcha = $state("");

	function scrollTo(index: number, selector: string) {
		const el = document.querySelector(selector);
		if (el) {
			el.scrollIntoView({ behavior: "smooth" });
		}
	}

	function handleScroll() {
		if (!navbar) return;
		const scrollY = window.scrollY;
		const opacity = Math.min(0.35 + scrollY / 500, 0.85);
		navbar.style.backgroundColor = `rgba(0, 0, 0, ${opacity})`;
	}

	async function handleLogin(event: any) {
		event.preventDefault();
        if (captcha == "") {
            alert("Please wait for the CAPTCHA result");
            return;
        }

        const { error } = await api.login.post(fetch, {
            body: {
                username,
                password,
                "turnstile_response": captcha
            }
        });
        if (error) {
			loginError.set(error.value.error);
            goto("/newlogin")
        } else {
            window.location.href = "/games";
        }
	}

	onMount(() => {
		if (!navbar) return;
		window.addEventListener("scroll", handleScroll);
		return () => {
			window.removeEventListener("scroll", handleScroll);
		};
	});
</script>

<div class="text-white min-h-[66px] fixed right-0 left-0 top-0 flex justify-center z-[1]" style="background-color: rgba(0, 0, 0, .35)" bind:this={navbar}>
	<div class="flex flex-row w-[940px] lg:w-[1140px]">
		<div class="hidden sm:flex items-center mr-2">
			<img class="h-[36px] w-[36px]" src="/images/landing/logo.png" alt="ROBLOX Logo">
		</div>

		<div class="flex flex-row items-center">
			<a class="nav-link">Play</a>
			<a class="nav-link">About</a>
			<a class="nav-link">Platforms</a>
		</div>

		<div class="hidden sm:flex flex-col ml-auto justify-center max-w-[450px] lg:mr-28">
			<form class="flex flex-row items-start mt-2" onsubmit={handleLogin}>
				<input bind:value={username} type="text" placeholder="Username" class="landing-form-control mr-1 !max-w-[164px]" name="username">
				<input bind:value={password} type="password" placeholder="Password" class="landing-form-control mr-1 !max-w-[164px]" name="password">
				<Turnstile
					on:callback={(event) => captcha = event.detail.token}
					siteKey={captchaKey}
					responseField={false}
				/>
				<button class="login-btn" type="submit" onclick={handleLogin}>Log In</button>
			</form>

			<a class="text-[13px] font-normal !text-white leading-[15px]" href="/Login/ResetPasswordRequest.ashx">Forgot Username/Password?</a>
		</div>
	</div>
</div>

<style>
	.nav-link {
		color: white;
		font-size: 18px;
		padding: 14px 15px;
		font-weight: 300;
		text-align: center;
	}

	.login-btn {
		padding: 0px 12px;
		font-weight: 400;
		font-size: 14px;
		width: 94px;
		color: white;
		background-color: #00B259;
		border-radius: 3px;
		box-shadow: inset 0 1px 1px rgba(0, 0, 0, 0.075);
		height: 32px;
		border: 1px solid transparent;
	}
</style>