<script lang="ts">
    import Button from "@components/legacy/Button.svelte";
    import { Turnstile } from "svelte-turnstile";
    import { api } from "@client/api";
    import { loginError } from "@client/stores";

    let username = $state("");
    let password = $state("");
    let captcha = $state("");

    const { data } = $props();

    async function handleSubmit(event: any) {
        event.preventDefault();
        if(captcha == "") {
            loginError.set("Please wait for the CAPTCHA result");
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
        } else {
            loginError.set("");
            window.location.href = "/games";
        }
    }
</script>

<h1 class="pl-8 sm:pl-0">Login to ROBLOX</h1>

{#if $loginError != ""}
    <p class="login-error">{$loginError}</p>
{/if}

<div class="flex flex-row divider-bottom pb-6 pl-8 sm:pl-0" onsubmit={handleSubmit}>
    <form class="w-[465px] pb-[20px] pl-[20px] flex flex-col" method="POST">
        <div class="flex flex-row mb-[20px] mt-2">
            <span class="pr-[5px] font-semibold text-[14px] color-[#343434]">Username: </span>
            <input name="username" class="text-box text-box-medium w-[242px]" type="text" bind:value={username}>
        </div>

        <div class="flex flex-row">
            <span class="pr-[8px] font-semibold text-[14px] color-[#343434]">Password: </span>
            <input name="password" class="text-box text-box-medium w-[242px]" type="password" bind:value={password}>
        </div>

        <Turnstile
            on:callback={(event) => captcha = event.detail.token}
            siteKey={data.captchaKey}
            responseField={false}
        />

        <div class="flex flex-row mt-8">
            <a class="text-link text-[12px]" href="/Login/ResetPasswordRequest.aspx" target="_blank">Forgot your password?</a>
            <Button class="ml-30 mt-[-8px]" size="medium" type="neutral" text="Sign In" submit />
        </div>
    </form>

    <div class="w-[484px] pb-[20px] pt-2 divider-left hidden sm:flex flex-col items-center">
        <p class="font-normal text-[12px] mt-[9px] mb-[5px]">Not a member?</p>
        <h2>Sign Up to Build & Make Friends</h2>
        <Button class="mt-[24px] mb-[13px]" size="medium" type="primary" text="Sign Up" href="/" />
    </div>
</div>

<div class="mt-[18px] pl-8 sm:pl-0">
    <h2>You don't need an account to play ROBLOX</h2>
    <p class="m-[12px] text">You can start playing right now, in guest mode! <Button size="small" type="neutral" text="Play as Guest" href="https://cataas.com/cat" /></p>
</div>

<style>
    .login-error {
        background-color: #FAE5E5;
        border: 1px solid #C00;
        padding: 5px 10px;
        font-size: 12px;
        color: #343434;
        font-weight: 400;
        margin-top: 10px;
        margin-bottom: 10px;
        margin-left: 1px;
    }
</style>