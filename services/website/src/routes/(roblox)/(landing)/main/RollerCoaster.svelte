<script lang="ts">
	import Button from "@components/Button.svelte";
	import Birthday from "./Birthday.svelte";
	import Gender from "./Gender.svelte";
	import { UserGender } from "@/types/types";
	import { field, form } from "svelte-forms";
	import {
		matchField,
		max,
		min,
		pattern,
		required,
		not,
	} from "svelte-forms/validators";
	import { notZeroOrEmpty, takenUsername, validGender, validInviteCode } from "./validators";
	import { Turnstile } from "svelte-turnstile";
	import { api } from "@client/api";
	import badpasswordsRaw from "@assets/badpasswords.txt?raw";
	const badpasswords = badpasswordsRaw.split("\n");
	function notCommonPassword(badpasswords: string[]) {
		return (value: string) => {
			const valid = !badpasswords.includes(value);
			if (!valid) {
				console.log(`HIT in badpasswords: ${value}`);
			}
			return {
				valid,
				name: "common",
			};
		};
	}

	let { isTestWebsite, signUpEnabled, captchaKey, inviteAutofill } = $props();
	let formWasSubmitted = $state(false);
	let captcha = $state("");

	const username = field("username", "", [
		min(3),
		max(20),
		required(),
		takenUsername(),
		pattern(/^(?!_)[a-zA-Z0-9_ ]+(?<!_)$/),
	]);
	const password = field("password", "", [
		min(6),
		max(64),
		required(),
		pattern(/^(?=(?:.*\d){2,}).*$/),
		notCommonPassword(badpasswords),
	]);
	const cpassword = field("cpassword", "", [matchField(password), required()]);

	const year = field("year", 0, [notZeroOrEmpty()]);
	const month = field("month", "", [notZeroOrEmpty()]);
	const day = field("day", 0, [notZeroOrEmpty()]);
	const gender = field("gender", UserGender.Unknown, [validGender()]);
	const invite = field("invite", "", isTestWebsite ? [validInviteCode()] : []);
	const signUpForm = form(username, password, cpassword, month, gender, invite);

	if (isTestWebsite) {
		invite.set(inviteAutofill || "");
	}

	async function handleSubmit(event: any) {
		event.preventDefault();
		formWasSubmitted = true;
		await signUpForm.validate();

		if (!$signUpForm.valid) {
			return;
		}
		if (captcha == "") {
			alert("Please wait for the CAPTCHA result");
			return;
		}

		const monthInt = new Date(`${$month.value} 1, 2000`).getMonth();
		const { error } = await api.register.post(fetch, {
			body: {
				username: $username.value,
				password: $password.value,
				gender: $gender.value,
				birthday: new Date($year.value, monthInt, $day.value).toISOString(),
				invite: $invite.value,
				turnstile_response: captcha,
			},
		});
		if (error) {
			alert(error.value.error);
		} else {
			window.location.href = "/games";
		}
	}
</script>

<div class="rollercoaster">
	<div
		class="flex flex-col md:flex-row items-center md:items-start absolute md:top-[200px] w-full justify-center"
	>
		<div class="flex flex-col items-center md:items-start mt-24 mb-3 md:mb-0">
			<img
				class="w-[457px] max-w-[100%] h-auto md:mr-[20px] z-[2]"
				src="/images/landing/logo-big.png"
				alt="ROBLOX"
			/>
			<h1
				class="text-white text-[35px] bg-[rgba(0,0,0,0.7)] py-[15px] px-[25px] font-light mt-[-20px] md:ml-14.5 tracking-[0px]"
			>
				Powering Imagination
			</h1>
		</div>

		<div
			class="bg-[rgba(255,255,255,0.95)] px-[15px] pb-[25px] pt-[15px] max-w-[370px] md:max-w-[435px] w-full"
		>
			<form class="px-[10px] flex flex-col" onsubmit={handleSubmit}>
				<h3 class="text-center mb-3 !text-[24px]">
					SIGN UP AND START HAVING FUN!
				</h3>

				<input
					name="username"
					class="landing-form-control signup-field"
					type="text"
					placeholder="Username (length 3-20, _ is allowed)"
					class:invalid={$username.invalid}
					class:valid={($username.dirty || formWasSubmitted) && $username.valid}
					bind:value={$username.value}
				/>
				<span class="h-[23px] text-[#d86868] pt-0.5">
					{#if $signUpForm.hasError("username.required")}
						Please enter a username.
					{:else if $signUpForm.hasError("username.min")}
						Too short
					{:else if $signUpForm.hasError("username.max")}
						Too long
					{:else if $signUpForm.hasError("username.pattern")}
						Invalid username
					{:else if $signUpForm.hasError("username.taken")}
						This username is already in use.
					{/if}
				</span>

				<input
					name="password"
					class="landing-form-control signup-field"
					type="password"
					placeholder="Password (minimum length 8)"
					class:invalid={$password.invalid}
					class:valid={($password.dirty || formWasSubmitted) && $password.valid}
					bind:value={$password.value}
				/>
				<span class="h-[23px] text-[#d86868] pt-0.5">
					{#if $signUpForm.hasError("password.required") || $signUpForm.hasError("password.min")}
						Too short
					{:else if $signUpForm.hasError("password.max")}
						Too long
					{:else if $signUpForm.hasError("password.pattern")}
						Needs 2 numbers
					{:else if $signUpForm.hasError("password.common")}
						Password is too common
					{/if}
				</span>

				<input
					name="cpassword"
					class="landing-form-control signup-field"
					type="password"
					placeholder="Confirm Password"
					class:invalid={$cpassword.invalid}
					class:valid={($cpassword.dirty || formWasSubmitted) &&
						$cpassword.valid}
					bind:value={$cpassword.value}
				/>
				<span class="h-[23px] text-[#d86868] pt-0.5">
					{#if $signUpForm.hasError("cpassword.match_field")}
						Passwords don't match
					{:else if $signUpForm.hasError("cpassword.required")}
						Please enter a password confirmation.
					{/if}
				</span>

				{#if isTestWebsite && signUpEnabled}
					<input
						name="invite"
						class="landing-form-control signup-field"
						type="text"
						placeholder="Beta Code"
						bind:value={$invite.value}
						class:invalid={$invite.invalid}
						class:valid={($invite.dirty || formWasSubmitted) && $invite.valid}
					/>
					<span class="h-[23px] text-[#d86868] pt-0.5">
						{#if $signUpForm.hasError("invite.invalid")}
							Invalid beta code
						{/if}
					</span>
				{/if}


				<Birthday
					bind:month={$month.value}
					bind:year={$year.value}
					bind:day={$day.value}
					valid={($month.dirty || formWasSubmitted) &&
						$month.valid &&
						($day.dirty || formWasSubmitted) &&
						$day.valid &&
						($year.dirty || formWasSubmitted) &&
						$year.valid}
					invalid={$month.invalid || $day.invalid || $year.invalid}
				/>
				<span class="h-[23px] text-[#d86868] pt-0.5">
					{#if $signUpForm.hasError("day.required") || $signUpForm.hasError("year.required") || $signUpForm.hasError("month.required")}
						Invalid birthday
					{/if}
				</span>

				<Gender
					bind:gender={$gender.value}
					bind:invalid={$gender.invalid}
					valid={($gender.dirty || formWasSubmitted) && $gender.valid}
				/>
				<span class="h-[23px] text-[#d86868] pt-0.5">
					{#if $signUpForm.hasError("gender.required")}
						Gender is required
					{/if}
				</span>

				<Turnstile
					on:callback={(event) => (captcha = event.detail.token)}
					siteKey={captchaKey}
					responseField={false}
				/>

				<Button
					class="!h-[46px] !text-[20px]"
					type="primary"
					size="md"
					text="Sign Up"
					submit
					disabled={!signUpEnabled}
				/>
				{#if !signUpEnabled}
					<span class="text-red-600 text-center mt-2 block">
						Creating new accounts is currently disabled. Check back later!
					</span>
				{/if}
				{#if isTestWebsite && signUpEnabled}
					<div class="bg-red-600 rounded p-2 mt-2">
						<span class="text-white font-normal text-center mt-2 block">
							You've found the <span class="font-bold underline"
								>2x2 testing website</span
							>! Accounts created here require a beta code to sign up.<br
							/>Remember: Nothing here is permanent.
						</span>
					</div>
				{/if}
			</form>
		</div>
	</div>

	<div
		class="absolute hidden md:flex flex-col bottom-[4%] left-[20%] text-[28px] text-white"
	>
		<span>Game: ROBLOX Point</span>
		<span class="mt-[-8px]">Developer: StarMarine614</span>
	</div>
</div>

<style>
	.signup-field {
		width: 100%;
		height: 46px;
		line-height: 1.33;
		border-radius: 6px;
		font-size: 20px;
		box-sizing: border-box;
	}

	.rollercoaster {
		height: 100%;
		min-height: 840px;
		background-image: url("/images/landing/RollerCoaster.jpg");
		background-repeat: no-repeat;
		background-size: cover;
		z-index: 0;
		position: relative;
	}
</style>
