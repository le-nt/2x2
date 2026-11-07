<script lang="ts">
    interface Props {
        type: "secondary" | "primary" | "control" | "buy" | "special";
        size: "xs" | "sm" | "md" | "lg";
        text: string;
        href?: string;
        class?: string;
        target?: string;
        submit?: boolean;
        disabled?: boolean;
		onclick?: any;
    }

    const {
        type,
        size,
        text,
        href,
        class: additionalClasses = "",
        submit,
        disabled,
        ...rest
    }: Props = $props();
    const buttonClass = `btn-${type}-${size} ${additionalClasses}`;
</script>

{#if href}
    <a {href} class={buttonClass} {...rest}>
        {text}
    </a>
{:else}
    <button type={submit ? "submit" : "button"} class={buttonClass} {...rest} disabled={disabled}>
        {@html text}
    </button>
{/if}

<style>
    /* I added button, a instead of button. Let's hope it doesn't break anything. */
    button, a {
        box-sizing: border-box;
    }

    .btn,
    .btn-primary-lg,
    .btn-primary-md,
    .btn-primary-sm,
    .btn-primary-xs,
    .btn-special-lg,
    .btn-special-md,
    .btn-special-sm,
    .btn-special-xs,
    .btn-secondary-lg,
    .btn-secondary-md,
    .btn-secondary-sm,
    .btn-secondary-xs,
    .btn-control-lg,
    .btn-control-md,
    .btn-control-sm,
    .btn-control-xs,
    .btn-generic-edit-lg,
    a.btn-generic-edit-lg,
    .btn-generic-edit-md,
    a.btn-generic-edit-md,
    .btn-generic-edit-sm,
    a.btn-generic-edit-sm,
    .btn-generic-edit-xs,
    a.btn-generic-edit-xs,
    .btn-buy-lg,
    .btn-buy-md,
    .btn-buy-sm,
    .btn-buy-xs,
    .input-group .input-addon-btn,
    .input-group-btn .input-dropdown-btn {
        display: inline-block;
        margin-bottom: 0;
        font-weight: normal;
        text-align: center;
        vertical-align: middle;
        cursor: pointer;
        background-image: none;
        border: 1px solid transparent;
        border-top-color: transparent;
        border-right-color: transparent;
        border-bottom-color: transparent;
        border-left-color: transparent;
        white-space: nowrap;
        padding: 6px 12px;
        font-size: 16px;
        line-height: 1.25;
        border-radius: 3px;
        -webkit-user-select: none;
        -moz-user-select: none;
        -ms-user-select: none;
        user-select: none;
    }

    .btn-primary-lg {
        -webkit-user-select: none;
        -moz-user-select: none;
        -ms-user-select: none;
        user-select: none;
        border: 1px solid transparent;
        background-color: #02b757;
        border-color: #02b757;
        color: #fff;
        cursor: pointer;
        display: inline-block;
        font-weight: 400;
        height: auto;
        transition: all, 0.2s, ease-in-out;
        text-align: center;
        white-space: nowrap;
        vertical-align: middle;
        padding: 15px 15px;
        font-size: 21px;
        line-height: 100%;
        border-radius: 5px;
    }
    .btn-primary-lg:link {
        color: #fff;
    }
    .btn-primary-lg:hover,
    .btn-primary-lg:focus {
        background-color: #3fc679;
        box-shadow: 0 1px 3px rgba(150, 150, 150, 0.74);
        border-color: #3fc679;
        color: #fff;
        cursor: pointer;
    }
    .btn-primary-lg:active,
    .btn-primary-lg.active {
        box-shadow: none;
        background-color: #3fc679;
        color: #fff;
    }
    .btn-primary-lg:active:focus,
    .btn-primary-lg.active:focus {
        outline: 0 none;
    }
    .btn-primary-lg:visited {
        box-shadow: none;
        color: #fff;
    }
    .btn-primary-lg:visited:focus {
        outline: 0 none;
    }
    .btn-primary-lg.disabled,
    .btn-primary-lg.disabled:hover,
    .btn-primary-lg.disabled:focus,
    .btn-primary-lg.disabled:active,
    .btn-primary-lg.disabled.active,
    .btn-primary-lg[disabled],
    .btn-primary-lg[disabled]:hover,
    .btn-primary-lg[disabled]:focus,
    .btn-primary-lg[disabled]:active,
    .btn-primary-lg[disabled].active {
        opacity: 1;
        background-color: #a3e2bd;
        border-color: #a3e2bd;
        color: #fff;
    }
    .btn-primary-md {
        -webkit-user-select: none;
        -moz-user-select: none;
        -ms-user-select: none;
        user-select: none;
        border: 1px solid transparent;
        background-color: #02b757;
        border-color: #02b757;
        color: #fff;
        cursor: pointer;
        display: inline-block;
        font-weight: 400;
        height: auto;
        transition: all, 0.2s, ease-in-out;
        text-align: center;
        white-space: nowrap;
        vertical-align: middle;
        padding: 9px 9px;
        font-size: 18px;
        line-height: 100%;
        border-radius: 3px;
    }
    .btn-primary-md:link {
        color: #fff;
    }
    .btn-primary-md:hover,
    .btn-primary-md:focus {
        background-color: #3fc679;
        box-shadow: 0 1px 3px rgba(150, 150, 150, 0.74);
        border-color: #3fc679;
        color: #fff;
        cursor: pointer;
    }
    .btn-primary-md:active,
    .btn-primary-md.active {
        box-shadow: none;
        background-color: #3fc679;
        color: #fff;
    }
    .btn-primary-md:active:focus,
    .btn-primary-md.active:focus {
        outline: 0 none;
    }
    .btn-primary-md:visited {
        box-shadow: none;
        color: #fff;
    }
    .btn-primary-md:visited:focus {
        outline: 0 none;
    }
    .btn-primary-md.disabled,
    .btn-primary-md.disabled:hover,
    .btn-primary-md.disabled:focus,
    .btn-primary-md.disabled:active,
    .btn-primary-md.disabled.active,
    .btn-primary-md[disabled],
    .btn-primary-md[disabled]:hover,
    .btn-primary-md[disabled]:focus,
    .btn-primary-md[disabled]:active,
    .btn-primary-md[disabled].active {
        opacity: 1;
        background-color: #a3e2bd;
        border-color: #a3e2bd;
        color: #fff;
    }
    @media (max-width: 767px) {
        .btn-primary-md {
            padding: 7px 7px;
            font-size: 16px;
            line-height: 100%;
            border-radius: 3px;
        }
    }
    .btn-primary-sm {
        -webkit-user-select: none;
        -moz-user-select: none;
        -ms-user-select: none;
        user-select: none;
        border: 1px solid transparent;
        background-color: #02b757;
        border-color: #02b757;
        color: #fff;
        cursor: pointer;
        display: inline-block;
        font-weight: 400;
        height: auto;
        transition: all, 0.2s, ease-in-out;
        text-align: center;
        white-space: nowrap;
        vertical-align: middle;
        padding: 7px 7px;
        font-size: 16px;
        line-height: 100%;
        border-radius: 3px;
    }
    .btn-primary-sm:link {
        color: #fff;
    }
    .btn-primary-sm:hover,
    .btn-primary-sm:focus {
        background-color: #3fc679;
        box-shadow: 0 1px 3px rgba(150, 150, 150, 0.74);
        border-color: #3fc679;
        color: #fff;
        cursor: pointer;
    }
    .btn-primary-sm:active,
    .btn-primary-sm.active {
        box-shadow: none;
        background-color: #3fc679;
        color: #fff;
    }
    .btn-primary-sm:active:focus,
    .btn-primary-sm.active:focus {
        outline: 0 none;
    }
    .btn-primary-sm:visited {
        box-shadow: none;
        color: #fff;
    }
    .btn-primary-sm:visited:focus {
        outline: 0 none;
    }
    .btn-primary-sm.disabled,
    .btn-primary-sm.disabled:hover,
    .btn-primary-sm.disabled:focus,
    .btn-primary-sm.disabled:active,
    .btn-primary-sm.disabled.active,
    .btn-primary-sm[disabled],
    .btn-primary-sm[disabled]:hover,
    .btn-primary-sm[disabled]:focus,
    .btn-primary-sm[disabled]:active,
    .btn-primary-sm[disabled].active {
        opacity: 1;
        background-color: #a3e2bd;
        border-color: #a3e2bd;
        color: #fff;
    }
    .btn-primary-xs {
        -webkit-user-select: none;
        -moz-user-select: none;
        -ms-user-select: none;
        user-select: none;
        border: 1px solid transparent;
        background-color: #02b757;
        border-color: #02b757;
        color: #fff;
        cursor: pointer;
        display: inline-block;
        font-weight: 400;
        height: auto;
        transition: all, 0.2s, ease-in-out;
        text-align: center;
        white-space: nowrap;
        vertical-align: middle;
        padding: 4px 4px;
        font-size: 14px;
        line-height: 100%;
        border-radius: 3px;
    }
    .btn-primary-xs:link {
        color: #fff;
    }
    .btn-primary-xs:hover,
    .btn-primary-xs:focus {
        background-color: #3fc679;
        box-shadow: 0 1px 3px rgba(150, 150, 150, 0.74);
        border-color: #3fc679;
        color: #fff;
        cursor: pointer;
    }
    .btn-primary-xs:active,
    .btn-primary-xs.active {
        box-shadow: none;
        background-color: #3fc679;
        color: #fff;
    }
    .btn-primary-xs:active:focus,
    .btn-primary-xs.active:focus {
        outline: 0 none;
    }
    .btn-primary-xs:visited {
        box-shadow: none;
        color: #fff;
    }
    .btn-primary-xs:visited:focus {
        outline: 0 none;
    }
    .btn-primary-xs.disabled,
    .btn-primary-xs.disabled:hover,
    .btn-primary-xs.disabled:focus,
    .btn-primary-xs.disabled:active,
    .btn-primary-xs.disabled.active,
    .btn-primary-xs[disabled],
    .btn-primary-xs[disabled]:hover,
    .btn-primary-xs[disabled]:focus,
    .btn-primary-xs[disabled]:active,
    .btn-primary-xs[disabled].active {
        opacity: 1;
        background-color: #a3e2bd;
        border-color: #a3e2bd;
        color: #fff;
    }
    .btn-special-lg {
        -webkit-user-select: none;
        -moz-user-select: none;
        -ms-user-select: none;
        user-select: none;
        border: 1px solid transparent;
        background-color: #8b5cf6;
        border-color: #8b5cf6;
        color: #fff;
        cursor: pointer;
        display: inline-block;
        font-weight: 400;
        height: auto;
        transition: all, 0.2s, ease-in-out;
        text-align: center;
        white-space: nowrap;
        vertical-align: middle;
        padding: 15px 15px;
        font-size: 21px;
        line-height: 100%;
        border-radius: 5px;
    }
    .btn-special-lg:link {
        color: #fff;
    }
    .btn-special-lg:hover,
    .btn-special-lg:focus {
        background-color: #a78bfa;
        box-shadow: 0 1px 3px rgba(150, 150, 150, 0.74);
        border-color: #a78bfa;
        color: #fff;
        cursor: pointer;
    }
    .btn-special-lg:active,
    .btn-special-lg.active {
        box-shadow: none;
        background-color: #a78bfa;
        color: #fff;
    }
    .btn-special-lg:active:focus,
    .btn-special-lg.active:focus {
        outline: 0 none;
    }
    .btn-special-lg:visited {
        box-shadow: none;
        color: #fff;
    }
    .btn-special-lg:visited:focus {
        outline: 0 none;
    }
    .btn-special-lg.disabled,
    .btn-special-lg.disabled:hover,
    .btn-special-lg.disabled:focus,
    .btn-special-lg.disabled:active,
    .btn-special-lg.disabled.active,
    .btn-special-lg[disabled],
    .btn-special-lg[disabled]:hover,
    .btn-special-lg[disabled]:focus,
    .btn-special-lg[disabled]:active,
    .btn-special-lg[disabled].active {
        opacity: 1;
        background-color: #ddd6fe;
        border-color: #ddd6fe;
        color: #fff;
    }
    .btn-special-md {
        -webkit-user-select: none;
        -moz-user-select: none;
        -ms-user-select: none;
        user-select: none;
        border: 1px solid transparent;
        background-color: #8b5cf6;
        border-color: #8b5cf6;
        color: #fff;
        cursor: pointer;
        display: inline-block;
        font-weight: 400;
        height: auto;
        transition: all, 0.2s, ease-in-out;
        text-align: center;
        white-space: nowrap;
        vertical-align: middle;
        padding: 9px 9px;
        font-size: 18px;
        line-height: 100%;
        border-radius: 3px;
    }
    .btn-special-md:link {
        color: #fff;
    }
    .btn-special-md:hover,
    .btn-special-md:focus {
        background-color: #a78bfa;
        box-shadow: 0 1px 3px rgba(150, 150, 150, 0.74);
        border-color: #a78bfa;
        color: #fff;
        cursor: pointer;
    }
    .btn-special-md:active,
    .btn-special-md.active {
        box-shadow: none;
        background-color: #a78bfa;
        color: #fff;
    }
    .btn-special-md:active:focus,
    .btn-special-md.active:focus {
        outline: 0 none;
    }
    .btn-special-md:visited {
        box-shadow: none;
        color: #fff;
    }
    .btn-special-md:visited:focus {
        outline: 0 none;
    }
    .btn-special-md.disabled,
    .btn-special-md.disabled:hover,
    .btn-special-md.disabled:focus,
    .btn-special-md.disabled:active,
    .btn-special-md.disabled.active,
    .btn-special-md[disabled],
    .btn-special-md[disabled]:hover,
    .btn-special-md[disabled]:focus,
    .btn-special-md[disabled]:active,
    .btn-special-md[disabled].active {
        opacity: 1;
        background-color: #ddd6fe;
        border-color: #ddd6fe;
        color: #fff;
    }
    @media (max-width: 767px) {
        .btn-special-md {
            padding: 7px 7px;
            font-size: 16px;
            line-height: 100%;
            border-radius: 3px;
        }
    }
    .btn-special-sm {
        -webkit-user-select: none;
        -moz-user-select: none;
        -ms-user-select: none;
        user-select: none;
        border: 1px solid transparent;
        background-color: #8b5cf6;
        border-color: #8b5cf6;
        color: #fff;
        cursor: pointer;
        display: inline-block;
        font-weight: 400;
        height: auto;
        transition: all, 0.2s, ease-in-out;
        text-align: center;
        white-space: nowrap;
        vertical-align: middle;
        padding: 7px 7px;
        font-size: 16px;
        line-height: 100%;
        border-radius: 3px;
    }
    .btn-special-sm:link {
        color: #fff;
    }
    .btn-special-sm:hover,
    .btn-special-sm:focus {
        background-color: #a78bfa;
        box-shadow: 0 1px 3px rgba(150, 150, 150, 0.74);
        border-color: #a78bfa;
        color: #fff;
        cursor: pointer;
    }
    .btn-special-sm:active,
    .btn-special-sm.active {
        box-shadow: none;
        background-color: #a78bfa;
        color: #fff;
    }
    .btn-special-sm:active:focus,
    .btn-special-sm.active:focus {
        outline: 0 none;
    }
    .btn-special-sm:visited {
        box-shadow: none;
        color: #fff;
    }
    .btn-special-sm:visited:focus {
        outline: 0 none;
    }
    .btn-special-sm.disabled,
    .btn-special-sm.disabled:hover,
    .btn-special-sm.disabled:focus,
    .btn-special-sm.disabled:active,
    .btn-special-sm.disabled.active,
    .btn-special-sm[disabled],
    .btn-special-sm[disabled]:hover,
    .btn-special-sm[disabled]:focus,
    .btn-special-sm[disabled]:active,
    .btn-special-sm[disabled].active {
        opacity: 1;
        background-color: #ddd6fe;
        border-color: #ddd6fe;
        color: #fff;
    }
    .btn-special-xs {
        -webkit-user-select: none;
        -moz-user-select: none;
        -ms-user-select: none;
        user-select: none;
        border: 1px solid transparent;
        background-color: #8b5cf6;
        border-color: #8b5cf6;
        color: #fff;
        cursor: pointer;
        display: inline-block;
        font-weight: 400;
        height: auto;
        transition: all, 0.2s, ease-in-out;
        text-align: center;
        white-space: nowrap;
        vertical-align: middle;
        padding: 4px 4px;
        font-size: 14px;
        line-height: 100%;
        border-radius: 3px;
    }
    .btn-special-xs:link {
        color: #fff;
    }
    .btn-special-xs:hover,
    .btn-special-xs:focus {
        background-color: #a78bfa;
        box-shadow: 0 1px 3px rgba(150, 150, 150, 0.74);
        border-color: #a78bfa;
        color: #fff;
        cursor: pointer;
    }
    .btn-special-xs:active,
    .btn-special-xs.active {
        box-shadow: none;
        background-color: #a78bfa;
        color: #fff;
    }
    .btn-special-xs:active:focus,
    .btn-special-xs.active:focus {
        outline: 0 none;
    }
    .btn-special-xs:visited {
        box-shadow: none;
        color: #fff;
    }
    .btn-special-xs:visited:focus {
        outline: 0 none;
    }
    .btn-special-xs.disabled,
    .btn-special-xs.disabled:hover,
    .btn-special-xs.disabled:focus,
    .btn-special-xs.disabled:active,
    .btn-special-xs.disabled.active,
    .btn-special-xs[disabled],
    .btn-special-xs[disabled]:hover,
    .btn-special-xs[disabled]:focus,
    .btn-special-xs[disabled]:active,
    .btn-special-xs[disabled].active {
        opacity: 1;
        background-color: #ddd6fe;
        border-color: #ddd6fe;
        color: #fff;
    }
    .btn-secondary-lg {
        -webkit-user-select: none;
        -moz-user-select: none;
        -ms-user-select: none;
        user-select: none;
        border: 1px solid transparent;
        background-color: #00a2ff;
        border-color: #00a2ff;
        color: #fff;
        cursor: pointer;
        display: inline-block;
        font-weight: 400;
        height: auto;
        transition: all, 0.2s, ease-in-out;
        text-align: center;
        white-space: nowrap;
        vertical-align: middle;
        padding: 15px 15px;
        font-size: 21px;
        line-height: 100%;
        border-radius: 5px;
    }
    .btn-secondary-lg:link {
        color: #fff;
    }
    .btn-secondary-lg:hover,
    .btn-secondary-lg:focus {
        background-color: #32b5ff;
        box-shadow: 0 1px 3px rgba(150, 150, 150, 0.74);
        border-color: #32b5ff;
        color: #fff;
        cursor: pointer;
    }
    .btn-secondary-lg:active,
    .btn-secondary-lg.active {
        box-shadow: none;
        background-color: #32b5ff;
        color: #fff;
    }
    .btn-secondary-lg:active:focus,
    .btn-secondary-lg.active:focus {
        outline: 0 none;
    }
    .btn-secondary-lg:visited {
        box-shadow: none;
        color: #fff;
    }
    .btn-secondary-lg:visited:focus {
        outline: 0 none;
    }
    .btn-secondary-lg.disabled,
    .btn-secondary-lg.disabled:hover,
    .btn-secondary-lg.disabled:focus,
    .btn-secondary-lg.disabled:active,
    .btn-secondary-lg.disabled.active,
    .btn-secondary-lg[disabled],
    .btn-secondary-lg[disabled]:hover,
    .btn-secondary-lg[disabled]:focus,
    .btn-secondary-lg[disabled]:active,
    .btn-secondary-lg[disabled].active {
        opacity: 1;
        background-color: #99daff;
        border-color: #99daff;
        color: #fff;
    }
    .btn-secondary-md {
        -webkit-user-select: none;
        -moz-user-select: none;
        -ms-user-select: none;
        user-select: none;
        border: 1px solid transparent;
        background-color: #00a2ff;
        border-color: #00a2ff;
        color: #fff;
        cursor: pointer;
        display: inline-block;
        font-weight: 400;
        height: auto;
        transition: all, 0.2s, ease-in-out;
        text-align: center;
        white-space: nowrap;
        vertical-align: middle;
        padding: 9px 9px;
        font-size: 18px;
        line-height: 100%;
        border-radius: 3px;
    }
    .btn-secondary-md:link {
        color: #fff;
    }
    .btn-secondary-md:hover,
    .btn-secondary-md:focus {
        background-color: #32b5ff;
        box-shadow: 0 1px 3px rgba(150, 150, 150, 0.74);
        border-color: #32b5ff;
        color: #fff;
        cursor: pointer;
    }
    .btn-secondary-md:active,
    .btn-secondary-md.active {
        box-shadow: none;
        background-color: #32b5ff;
        color: #fff;
    }
    .btn-secondary-md:active:focus,
    .btn-secondary-md.active:focus {
        outline: 0 none;
    }
    .btn-secondary-md:visited {
        box-shadow: none;
        color: #fff;
    }
    .btn-secondary-md:visited:focus {
        outline: 0 none;
    }
    .btn-secondary-md.disabled,
    .btn-secondary-md.disabled:hover,
    .btn-secondary-md.disabled:focus,
    .btn-secondary-md.disabled:active,
    .btn-secondary-md.disabled.active,
    .btn-secondary-md[disabled],
    .btn-secondary-md[disabled]:hover,
    .btn-secondary-md[disabled]:focus,
    .btn-secondary-md[disabled]:active,
    .btn-secondary-md[disabled].active {
        opacity: 1;
        background-color: #99daff;
        border-color: #99daff;
        color: #fff;
    }
    @media (max-width: 767px) {
        .btn-secondary-md {
            padding: 7px 7px;
            font-size: 16px;
            line-height: 100%;
            border-radius: 3px;
        }
    }
    .btn-secondary-sm {
        -webkit-user-select: none;
        -moz-user-select: none;
        -ms-user-select: none;
        user-select: none;
        border: 1px solid transparent;
        background-color: #00a2ff;
        border-color: #00a2ff;
        color: #fff;
        cursor: pointer;
        display: inline-block;
        font-weight: 400;
        height: auto;
        transition: all, 0.2s, ease-in-out;
        text-align: center;
        white-space: nowrap;
        vertical-align: middle;
        padding: 7px 7px;
        font-size: 16px;
        line-height: 100%;
        border-radius: 3px;
    }
    .btn-secondary-sm:link {
        color: #fff;
    }
    .btn-secondary-sm:hover,
    .btn-secondary-sm:focus {
        background-color: #32b5ff;
        box-shadow: 0 1px 3px rgba(150, 150, 150, 0.74);
        border-color: #32b5ff;
        color: #fff;
        cursor: pointer;
    }
    .btn-secondary-sm:active,
    .btn-secondary-sm.active {
        box-shadow: none;
        background-color: #32b5ff;
        color: #fff;
    }
    .btn-secondary-sm:active:focus,
    .btn-secondary-sm.active:focus {
        outline: 0 none;
    }
    .btn-secondary-sm:visited {
        box-shadow: none;
        color: #fff;
    }
    .btn-secondary-sm:visited:focus {
        outline: 0 none;
    }
    .btn-secondary-sm.disabled,
    .btn-secondary-sm.disabled:hover,
    .btn-secondary-sm.disabled:focus,
    .btn-secondary-sm.disabled:active,
    .btn-secondary-sm.disabled.active,
    .btn-secondary-sm[disabled],
    .btn-secondary-sm[disabled]:hover,
    .btn-secondary-sm[disabled]:focus,
    .btn-secondary-sm[disabled]:active,
    .btn-secondary-sm[disabled].active {
        opacity: 1;
        background-color: #99daff;
        border-color: #99daff;
        color: #fff;
    }
    .btn-secondary-xs {
        background-color: #00a2ff;
        border-color: #00a2ff;
        color: #fff;
        height: auto;
        transition: all, 0.2s, ease-in-out;
        padding: 7px 16px;
        font-size: 1em;
        line-height: 100%;
        border-radius: 3px;
    }
    .btn-secondary-xs:link {
        color: #fff;
    }
    .btn-secondary-xs:hover,
    .btn-secondary-xs:focus {
        background-color: #32b5ff;
        box-shadow: 0 1px 3px rgba(150, 150, 150, 0.74);
        border-color: #32b5ff;
        color: #fff;
        cursor: pointer;
    }
    .btn-secondary-xs:active,
    .btn-secondary-xs.active {
        box-shadow: none;
        background-color: #32b5ff;
        color: #fff;
    }
    .btn-secondary-xs:active:focus,
    .btn-secondary-xs.active:focus {
        outline: 0 none;
    }
    .btn-secondary-xs:visited {
        box-shadow: none;
        color: #fff;
    }
    .btn-secondary-xs:visited:focus {
        outline: 0 none;
    }
    .btn-secondary-xs.disabled,
    .btn-secondary-xs.disabled:hover,
    .btn-secondary-xs.disabled:focus,
    .btn-secondary-xs.disabled:active,
    .btn-secondary-xs.disabled.active,
    .btn-secondary-xs[disabled],
    .btn-secondary-xs[disabled]:hover,
    .btn-secondary-xs[disabled]:focus,
    .btn-secondary-xs[disabled]:active,
    .btn-secondary-xs[disabled].active {
        opacity: 1;
        background-color: #99daff;
        border-color: #99daff;
        color: #fff;
    }
    .btn-control-lg {
        -webkit-user-select: none;
        -moz-user-select: none;
        -ms-user-select: none;
        user-select: none;
        border: 1px solid transparent;
        background-color: #fff;
        border-color: #b8b8b8;
        color: #757575;
        cursor: pointer;
        display: inline-block;
        font-weight: 400;
        height: auto;
        transition: all, 0.2s, ease-in-out;
        text-align: center;
        white-space: nowrap;
        vertical-align: middle;
        padding: 15px 15px;
        font-size: 21px;
        line-height: 100%;
        border-radius: 5px;
    }
    .btn-control-lg:link {
        color: #757575;
    }
    .btn-control-lg:hover,
    .btn-control-lg:focus {
        background-color: #fff;
        box-shadow: 0 1px 3px rgba(150, 150, 150, 0.74);
        border-color: #b8b8b8;
        color: #757575;
        cursor: pointer;
    }
    .btn-control-lg:active,
    .btn-control-lg.active {
        box-shadow: none;
        background-color: #fff;
        color: #757575;
    }
    .btn-control-lg:active:focus,
    .btn-control-lg.active:focus {
        outline: 0 none;
    }
    .btn-control-lg:visited {
        box-shadow: none;
        color: #757575;
    }
    .btn-control-lg:visited:focus {
        outline: 0 none;
    }
    .btn-control-lg.disabled,
    .btn-control-lg.disabled:hover,
    .btn-control-lg.disabled:focus,
    .btn-control-lg.disabled:active,
    .btn-control-lg.disabled.active,
    .btn-control-lg[disabled],
    .btn-control-lg[disabled]:hover,
    .btn-control-lg[disabled]:focus,
    .btn-control-lg[disabled]:active,
    .btn-control-lg[disabled].active {
        opacity: 1;
        background-color: #fff;
        border-color: #b8b8b8;
        color: #b8b8b8;
    }
    .btn-control-md {
        -webkit-user-select: none;
        -moz-user-select: none;
        -ms-user-select: none;
        user-select: none;
        border: 1px solid transparent;
        background-color: #fff;
        border-color: #b8b8b8;
        color: #757575;
        cursor: pointer;
        display: inline-block;
        font-weight: 400;
        height: auto;
        transition: all, 0.2s, ease-in-out;
        text-align: center;
        white-space: nowrap;
        vertical-align: middle;
        padding: 9px 9px;
        font-size: 18px;
        line-height: 100%;
        border-radius: 3px;
    }
    .btn-control-md:link {
        color: #757575;
    }
    .btn-control-md:hover,
    .btn-control-md:focus {
        background-color: #fff;
        box-shadow: 0 1px 3px rgba(150, 150, 150, 0.74);
        border-color: #b8b8b8;
        color: #757575;
        cursor: pointer;
    }
    .btn-control-md:active,
    .btn-control-md.active {
        box-shadow: none;
        background-color: #fff;
        color: #757575;
    }
    .btn-control-md:active:focus,
    .btn-control-md.active:focus {
        outline: 0 none;
    }
    .btn-control-md:visited {
        box-shadow: none;
        color: #757575;
    }
    .btn-control-md:visited:focus {
        outline: 0 none;
    }
    .btn-control-md.disabled,
    .btn-control-md.disabled:hover,
    .btn-control-md.disabled:focus,
    .btn-control-md.disabled:active,
    .btn-control-md.disabled.active,
    .btn-control-md[disabled],
    .btn-control-md[disabled]:hover,
    .btn-control-md[disabled]:focus,
    .btn-control-md[disabled]:active,
    .btn-control-md[disabled].active {
        opacity: 1;
        background-color: #fff;
        border-color: #b8b8b8;
        color: #b8b8b8;
    }
    @media (max-width: 767px) {
        .btn-control-md {
            padding: 7px 7px;
            font-size: 16px;
            line-height: 100%;
            border-radius: 3px;
        }
    }
    .btn-control-sm {
        -webkit-user-select: none;
        -moz-user-select: none;
        -ms-user-select: none;
        user-select: none;
        border: 1px solid transparent;
        background-color: #fff;
        border-color: #b8b8b8;
        color: #757575;
        cursor: pointer;
        display: inline-block;
        font-weight: 400;
        height: auto;
        transition: all, 0.2s, ease-in-out;
        text-align: center;
        white-space: nowrap;
        vertical-align: middle;
        padding: 7px 7px;
        font-size: 16px;
        line-height: 100%;
        border-radius: 3px;
    }
    .btn-control-sm:link {
        color: #757575;
    }
    .btn-control-sm:hover,
    .btn-control-sm:focus {
        background-color: #fff;
        box-shadow: 0 1px 3px rgba(150, 150, 150, 0.74);
        border-color: #b8b8b8;
        color: #757575;
        cursor: pointer;
    }
    .btn-control-sm:active,
    .btn-control-sm.active {
        box-shadow: none;
        background-color: #fff;
        color: #757575;
    }
    .btn-control-sm:active:focus,
    .btn-control-sm.active:focus {
        outline: 0 none;
    }
    .btn-control-sm:visited {
        box-shadow: none;
        color: #757575;
    }
    .btn-control-sm:visited:focus {
        outline: 0 none;
    }
    .btn-control-sm.disabled,
    .btn-control-sm.disabled:hover,
    .btn-control-sm.disabled:focus,
    .btn-control-sm.disabled:active,
    .btn-control-sm.disabled.active,
    .btn-control-sm[disabled],
    .btn-control-sm[disabled]:hover,
    .btn-control-sm[disabled]:focus,
    .btn-control-sm[disabled]:active,
    .btn-control-sm[disabled].active {
        opacity: 1;
        background-color: #fff;
        border-color: #b8b8b8;
        color: #b8b8b8;
    }
    .btn-control-xs {
        background-color: white;
        border-color: #b8b8b8;
        color: #757575;
        height: auto;
        transition: all,0.2s,ease-in-out;
        padding: 7px 16px;
        font-size: 1em;
        line-height: 100%;
        border-radius: 3px;
    }
    .btn-control-xs:link {
        color: #757575;
    }
    .btn-control-xs:hover,
    .btn-control-xs:focus {
        background-color: #fff;
        box-shadow: 0 1px 3px rgba(150, 150, 150, 0.74);
        border-color: #b8b8b8;
        color: #757575;
        cursor: pointer;
    }
    .btn-control-xs:active,
    .btn-control-xs.active {
        box-shadow: none;
        background-color: #fff;
        color: #757575;
    }
    .btn-control-xs:active:focus,
    .btn-control-xs.active:focus {
        outline: 0 none;
    }
    .btn-control-xs:visited {
        box-shadow: none;
        color: #757575;
    }
    .btn-control-xs:visited:focus {
        outline: 0 none;
    }
    .btn-control-xs.disabled,
    .btn-control-xs.disabled:hover,
    .btn-control-xs.disabled:focus,
    .btn-control-xs.disabled:active,
    .btn-control-xs.disabled.active,
    .btn-control-xs[disabled],
    .btn-control-xs[disabled]:hover,
    .btn-control-xs[disabled]:focus,
    .btn-control-xs[disabled]:active,
    .btn-control-xs[disabled].active {
        opacity: 1;
        background-color: #fff;
        border-color: #b8b8b8;
        color: #b8b8b8;
    }
    .btn-generic-edit-lg,
    a.btn-generic-edit-lg {
        -webkit-user-select: none;
        -moz-user-select: none;
        -ms-user-select: none;
        user-select: none;
        border: 1px solid transparent;
        background-color: #fff;
        border-color: #b8b8b8;
        color: #757575;
        cursor: pointer;
        display: inline-block;
        font-weight: 400;
        height: auto;
        transition: all, 0.2s, ease-in-out;
        text-align: center;
        white-space: nowrap;
        vertical-align: middle;
        padding: 15px 15px;
        font-size: 21px;
        line-height: 100%;
        border-radius: 5px;
    }
    .btn-generic-edit-lg:link,
    a.btn-generic-edit-lg:link {
        color: #757575;
    }
    .btn-generic-edit-lg:hover,
    .btn-generic-edit-lg:focus,
    a.btn-generic-edit-lg:hover,
    a.btn-generic-edit-lg:focus {
        background-color: #fff;
        box-shadow: 0 1px 3px rgba(150, 150, 150, 0.74);
        border-color: #b8b8b8;
        color: #757575;
        cursor: pointer;
    }
    .btn-generic-edit-lg:active,
    .btn-generic-edit-lg.active,
    a.btn-generic-edit-lg:active,
    a.btn-generic-edit-lg.active {
        box-shadow: none;
        background-color: #fff;
        color: #757575;
    }
    .btn-generic-edit-lg:active:focus,
    .btn-generic-edit-lg.active:focus,
    a.btn-generic-edit-lg:active:focus,
    a.btn-generic-edit-lg.active:focus {
        outline: 0 none;
    }
    .btn-generic-edit-lg:visited,
    a.btn-generic-edit-lg:visited {
        box-shadow: none;
        color: #757575;
    }
    .btn-generic-edit-lg:visited:focus,
    a.btn-generic-edit-lg:visited:focus {
        outline: 0 none;
    }
    .btn-generic-edit-lg.disabled,
    .btn-generic-edit-lg.disabled:hover,
    .btn-generic-edit-lg.disabled:focus,
    .btn-generic-edit-lg.disabled:active,
    .btn-generic-edit-lg.disabled.active,
    .btn-generic-edit-lg[disabled],
    .btn-generic-edit-lg[disabled]:hover,
    .btn-generic-edit-lg[disabled]:focus,
    .btn-generic-edit-lg[disabled]:active,
    .btn-generic-edit-lg[disabled].active,
    a.btn-generic-edit-lg.disabled,
    a.btn-generic-edit-lg.disabled:hover,
    a.btn-generic-edit-lg.disabled:focus,
    a.btn-generic-edit-lg.disabled:active,
    a.btn-generic-edit-lg.disabled.active,
    a.btn-generic-edit-lg[disabled],
    a.btn-generic-edit-lg[disabled]:hover,
    a.btn-generic-edit-lg[disabled]:focus,
    a.btn-generic-edit-lg[disabled]:active,
    a.btn-generic-edit-lg[disabled].active {
        opacity: 1;
        background-color: #fff;
        border-color: #b8b8b8;
        color: #b8b8b8;
    }
    .btn-generic-edit-md,
    a.btn-generic-edit-md {
        -webkit-user-select: none;
        -moz-user-select: none;
        -ms-user-select: none;
        user-select: none;
        border: 1px solid transparent;
        background-color: #fff;
        border-color: #b8b8b8;
        color: #757575;
        cursor: pointer;
        display: inline-block;
        font-weight: 400;
        height: auto;
        transition: all, 0.2s, ease-in-out;
        text-align: center;
        white-space: nowrap;
        vertical-align: middle;
        padding: 9px 9px;
        font-size: 18px;
        line-height: 100%;
        border-radius: 3px;
    }
    .btn-generic-edit-md:link,
    a.btn-generic-edit-md:link {
        color: #757575;
    }
    .btn-generic-edit-md:hover,
    .btn-generic-edit-md:focus,
    a.btn-generic-edit-md:hover,
    a.btn-generic-edit-md:focus {
        background-color: #fff;
        box-shadow: 0 1px 3px rgba(150, 150, 150, 0.74);
        border-color: #b8b8b8;
        color: #757575;
        cursor: pointer;
    }
    .btn-generic-edit-md:active,
    .btn-generic-edit-md.active,
    a.btn-generic-edit-md:active,
    a.btn-generic-edit-md.active {
        box-shadow: none;
        background-color: #fff;
        color: #757575;
    }
    .btn-generic-edit-md:active:focus,
    .btn-generic-edit-md.active:focus,
    a.btn-generic-edit-md:active:focus,
    a.btn-generic-edit-md.active:focus {
        outline: 0 none;
    }
    .btn-generic-edit-md:visited,
    a.btn-generic-edit-md:visited {
        box-shadow: none;
        color: #757575;
    }
    .btn-generic-edit-md:visited:focus,
    a.btn-generic-edit-md:visited:focus {
        outline: 0 none;
    }
    .btn-generic-edit-md.disabled,
    .btn-generic-edit-md.disabled:hover,
    .btn-generic-edit-md.disabled:focus,
    .btn-generic-edit-md.disabled:active,
    .btn-generic-edit-md.disabled.active,
    .btn-generic-edit-md[disabled],
    .btn-generic-edit-md[disabled]:hover,
    .btn-generic-edit-md[disabled]:focus,
    .btn-generic-edit-md[disabled]:active,
    .btn-generic-edit-md[disabled].active,
    a.btn-generic-edit-md.disabled,
    a.btn-generic-edit-md.disabled:hover,
    a.btn-generic-edit-md.disabled:focus,
    a.btn-generic-edit-md.disabled:active,
    a.btn-generic-edit-md.disabled.active,
    a.btn-generic-edit-md[disabled],
    a.btn-generic-edit-md[disabled]:hover,
    a.btn-generic-edit-md[disabled]:focus,
    a.btn-generic-edit-md[disabled]:active,
    a.btn-generic-edit-md[disabled].active {
        opacity: 1;
        background-color: #fff;
        border-color: #b8b8b8;
        color: #b8b8b8;
    }
    .btn-generic-edit-sm,
    a.btn-generic-edit-sm {
        -webkit-user-select: none;
        -moz-user-select: none;
        -ms-user-select: none;
        user-select: none;
        border: 1px solid transparent;
        background-color: #fff;
        border-color: #b8b8b8;
        color: #757575;
        cursor: pointer;
        display: inline-block;
        font-weight: 400;
        height: auto;
        transition: all, 0.2s, ease-in-out;
        text-align: center;
        white-space: nowrap;
        vertical-align: middle;
        padding: 7px 7px;
        font-size: 16px;
        line-height: 100%;
        border-radius: 3px;
    }
    .btn-generic-edit-sm:link,
    a.btn-generic-edit-sm:link {
        color: #757575;
    }
    .btn-generic-edit-sm:hover,
    .btn-generic-edit-sm:focus,
    a.btn-generic-edit-sm:hover,
    a.btn-generic-edit-sm:focus {
        background-color: #fff;
        box-shadow: 0 1px 3px rgba(150, 150, 150, 0.74);
        border-color: #b8b8b8;
        color: #757575;
        cursor: pointer;
    }
    .btn-generic-edit-sm:active,
    .btn-generic-edit-sm.active,
    a.btn-generic-edit-sm:active,
    a.btn-generic-edit-sm.active {
        box-shadow: none;
        background-color: #fff;
        color: #757575;
    }
    .btn-generic-edit-sm:active:focus,
    .btn-generic-edit-sm.active:focus,
    a.btn-generic-edit-sm:active:focus,
    a.btn-generic-edit-sm.active:focus {
        outline: 0 none;
    }
    .btn-generic-edit-sm:visited,
    a.btn-generic-edit-sm:visited {
        box-shadow: none;
        color: #757575;
    }
    .btn-generic-edit-sm:visited:focus,
    a.btn-generic-edit-sm:visited:focus {
        outline: 0 none;
    }
    .btn-generic-edit-sm.disabled,
    .btn-generic-edit-sm.disabled:hover,
    .btn-generic-edit-sm.disabled:focus,
    .btn-generic-edit-sm.disabled:active,
    .btn-generic-edit-sm.disabled.active,
    .btn-generic-edit-sm[disabled],
    .btn-generic-edit-sm[disabled]:hover,
    .btn-generic-edit-sm[disabled]:focus,
    .btn-generic-edit-sm[disabled]:active,
    .btn-generic-edit-sm[disabled].active,
    a.btn-generic-edit-sm.disabled,
    a.btn-generic-edit-sm.disabled:hover,
    a.btn-generic-edit-sm.disabled:focus,
    a.btn-generic-edit-sm.disabled:active,
    a.btn-generic-edit-sm.disabled.active,
    a.btn-generic-edit-sm[disabled],
    a.btn-generic-edit-sm[disabled]:hover,
    a.btn-generic-edit-sm[disabled]:focus,
    a.btn-generic-edit-sm[disabled]:active,
    a.btn-generic-edit-sm[disabled].active {
        opacity: 1;
        background-color: #fff;
        border-color: #b8b8b8;
        color: #b8b8b8;
    }
    .btn-generic-edit-xs,
    a.btn-generic-edit-xs {
        -webkit-user-select: none;
        -moz-user-select: none;
        -ms-user-select: none;
        user-select: none;
        border: 1px solid transparent;
        background-color: #fff;
        border-color: #b8b8b8;
        color: #757575;
        cursor: pointer;
        display: inline-block;
        font-weight: 400;
        height: auto;
        transition: all, 0.2s, ease-in-out;
        text-align: center;
        white-space: nowrap;
        vertical-align: middle;
        padding: 4px 4px;
        font-size: 14px;
        line-height: 100%;
        border-radius: 3px;
    }
    .btn-generic-edit-xs:link,
    a.btn-generic-edit-xs:link {
        color: #757575;
    }
    .btn-generic-edit-xs:hover,
    .btn-generic-edit-xs:focus,
    a.btn-generic-edit-xs:hover,
    a.btn-generic-edit-xs:focus {
        background-color: #fff;
        box-shadow: 0 1px 3px rgba(150, 150, 150, 0.74);
        border-color: #b8b8b8;
        color: #757575;
        cursor: pointer;
    }
    .btn-generic-edit-xs:active,
    .btn-generic-edit-xs.active,
    a.btn-generic-edit-xs:active,
    a.btn-generic-edit-xs.active {
        box-shadow: none;
        background-color: #fff;
        color: #757575;
    }
    .btn-generic-edit-xs:active:focus,
    .btn-generic-edit-xs.active:focus,
    a.btn-generic-edit-xs:active:focus,
    a.btn-generic-edit-xs.active:focus {
        outline: 0 none;
    }
    .btn-generic-edit-xs:visited,
    a.btn-generic-edit-xs:visited {
        box-shadow: none;
        color: #757575;
    }
    .btn-generic-edit-xs:visited:focus,
    a.btn-generic-edit-xs:visited:focus {
        outline: 0 none;
    }
    .btn-generic-edit-xs.disabled,
    .btn-generic-edit-xs.disabled:hover,
    .btn-generic-edit-xs.disabled:focus,
    .btn-generic-edit-xs.disabled:active,
    .btn-generic-edit-xs.disabled.active,
    .btn-generic-edit-xs[disabled],
    .btn-generic-edit-xs[disabled]:hover,
    .btn-generic-edit-xs[disabled]:focus,
    .btn-generic-edit-xs[disabled]:active,
    .btn-generic-edit-xs[disabled].active,
    a.btn-generic-edit-xs.disabled,
    a.btn-generic-edit-xs.disabled:hover,
    a.btn-generic-edit-xs.disabled:focus,
    a.btn-generic-edit-xs.disabled:active,
    a.btn-generic-edit-xs.disabled.active,
    a.btn-generic-edit-xs[disabled],
    a.btn-generic-edit-xs[disabled]:hover,
    a.btn-generic-edit-xs[disabled]:focus,
    a.btn-generic-edit-xs[disabled]:active,
    a.btn-generic-edit-xs[disabled].active {
        opacity: 1;
        background-color: #fff;
        border-color: #b8b8b8;
        color: #b8b8b8;
    }
    .btn-buy-lg {
        -webkit-user-select: none;
        -moz-user-select: none;
        -ms-user-select: none;
        user-select: none;
        border: 1px solid transparent;
        background-color: #fff;
        border-color: #b8b8b8;
        color: #757575;
        cursor: pointer;
        display: inline-block;
        font-weight: 400;
        height: auto;
        transition: all, 0.2s, ease-in-out;
        text-align: center;
        white-space: nowrap;
        vertical-align: middle;
        padding: 15px 15px;
        font-size: 21px;
        line-height: 100%;
        border-radius: 5px;
    }
    .btn-buy-lg:link {
        color: #757575;
    }
    .btn-buy-lg:hover,
    .btn-buy-lg:focus {
        background-color: #3fc679;
        box-shadow: 0 1px 3px rgba(150, 150, 150, 0.74);
        border-color: #3fc679;
        color: #fff;
        cursor: pointer;
    }
    .btn-buy-lg:active,
    .btn-buy-lg.active {
        box-shadow: none;
        background-color: #3fc679;
        color: #fff;
    }
    .btn-buy-lg:active:focus,
    .btn-buy-lg.active:focus {
        outline: 0 none;
    }
    .btn-buy-lg:visited {
        box-shadow: none;
        color: #fff;
    }
    .btn-buy-lg:visited:focus {
        outline: 0 none;
    }
    .btn-buy-lg.disabled,
    .btn-buy-lg.disabled:hover,
    .btn-buy-lg.disabled:focus,
    .btn-buy-lg.disabled:active,
    .btn-buy-lg.disabled.active,
    .btn-buy-lg[disabled],
    .btn-buy-lg[disabled]:hover,
    .btn-buy-lg[disabled]:focus,
    .btn-buy-lg[disabled]:active,
    .btn-buy-lg[disabled].active {
        opacity: 1;
        background-color: #fff;
        border-color: #b8b8b8;
        color: #b8b8b8;
    }
    .btn-buy-md {
        -webkit-user-select: none;
        -moz-user-select: none;
        -ms-user-select: none;
        user-select: none;
        border: 1px solid transparent;
        background-color: #fff;
        border-color: #b8b8b8;
        color: #757575;
        cursor: pointer;
        display: inline-block;
        font-weight: 400;
        height: auto;
        transition: all, 0.2s, ease-in-out;
        text-align: center;
        white-space: nowrap;
        vertical-align: middle;
        padding: 9px 9px;
        font-size: 18px;
        line-height: 100%;
        border-radius: 3px;
    }
    .btn-buy-md:link {
        color: #757575;
    }
    .btn-buy-md:hover,
    .btn-buy-md:focus {
        background-color: #3fc679;
        box-shadow: 0 1px 3px rgba(150, 150, 150, 0.74);
        border-color: #3fc679;
        color: #fff;
        cursor: pointer;
    }
    .btn-buy-md:active,
    .btn-buy-md.active {
        box-shadow: none;
        background-color: #3fc679;
        color: #fff;
    }
    .btn-buy-md:active:focus,
    .btn-buy-md.active:focus {
        outline: 0 none;
    }
    .btn-buy-md:visited {
        box-shadow: none;
        color: #fff;
    }
    .btn-buy-md:visited:focus {
        outline: 0 none;
    }
    .btn-buy-md.disabled,
    .btn-buy-md.disabled:hover,
    .btn-buy-md.disabled:focus,
    .btn-buy-md.disabled:active,
    .btn-buy-md.disabled.active,
    .btn-buy-md[disabled],
    .btn-buy-md[disabled]:hover,
    .btn-buy-md[disabled]:focus,
    .btn-buy-md[disabled]:active,
    .btn-buy-md[disabled].active {
        opacity: 1;
        background-color: #fff;
        border-color: #b8b8b8;
        color: #b8b8b8;
    }
    @media (max-width: 767px) {
        .btn-buy-md {
            padding: 7px 7px;
            font-size: 16px;
            line-height: 100%;
            border-radius: 3px;
        }
    }
    .btn-buy-sm {
        -webkit-user-select: none;
        -moz-user-select: none;
        -ms-user-select: none;
        user-select: none;
        border: 1px solid transparent;
        background-color: #fff;
        border-color: #b8b8b8;
        color: #757575;
        cursor: pointer;
        display: inline-block;
        font-weight: 400;
        height: auto;
        transition: all, 0.2s, ease-in-out;
        text-align: center;
        white-space: nowrap;
        vertical-align: middle;
        padding: 7px 7px;
        font-size: 16px;
        line-height: 100%;
        border-radius: 3px;
    }
    .btn-buy-sm:link {
        color: #757575;
    }
    .btn-buy-sm:hover,
    .btn-buy-sm:focus {
        background-color: #3fc679;
        box-shadow: 0 1px 3px rgba(150, 150, 150, 0.74);
        border-color: #3fc679;
        color: #fff;
        cursor: pointer;
    }
    .btn-buy-sm:active,
    .btn-buy-sm.active {
        box-shadow: none;
        background-color: #3fc679;
        color: #fff;
    }
    .btn-buy-sm:active:focus,
    .btn-buy-sm.active:focus {
        outline: 0 none;
    }
    .btn-buy-sm:visited {
        box-shadow: none;
        color: #fff;
    }
    .btn-buy-sm:visited:focus {
        outline: 0 none;
    }
    .btn-buy-sm.disabled,
    .btn-buy-sm.disabled:hover,
    .btn-buy-sm.disabled:focus,
    .btn-buy-sm.disabled:active,
    .btn-buy-sm.disabled.active,
    .btn-buy-sm[disabled],
    .btn-buy-sm[disabled]:hover,
    .btn-buy-sm[disabled]:focus,
    .btn-buy-sm[disabled]:active,
    .btn-buy-sm[disabled].active {
        opacity: 1;
        background-color: #fff;
        border-color: #b8b8b8;
        color: #b8b8b8;
    }
    .btn-buy-xs {
        -webkit-user-select: none;
        -moz-user-select: none;
        -ms-user-select: none;
        user-select: none;
        border: 1px solid transparent;
        background-color: #fff;
        border-color: #b8b8b8;
        color: #757575;
        cursor: pointer;
        display: inline-block;
        font-weight: 400;
        height: auto;
        transition: all, 0.2s, ease-in-out;
        text-align: center;
        white-space: nowrap;
        vertical-align: middle;
        padding: 4px 4px;
        font-size: 14px;
        line-height: 100%;
        border-radius: 3px;
    }
    .btn-buy-xs:link {
        color: #757575;
    }
    .btn-buy-xs:hover,
    .btn-buy-xs:focus {
        background-color: #3fc679;
        box-shadow: 0 1px 3px rgba(150, 150, 150, 0.74);
        border-color: #3fc679;
        color: #fff;
        cursor: pointer;
    }
    .btn-buy-xs:active,
    .btn-buy-xs.active {
        box-shadow: none;
        background-color: #3fc679;
        color: #fff;
    }
    .btn-buy-xs:active:focus,
    .btn-buy-xs.active:focus {
        outline: 0 none;
    }
    .btn-buy-xs:visited {
        box-shadow: none;
        color: #fff;
    }
    .btn-buy-xs:visited:focus {
        outline: 0 none;
    }
    .btn-buy-xs.disabled,
    .btn-buy-xs.disabled:hover,
    .btn-buy-xs.disabled:focus,
    .btn-buy-xs.disabled:active,
    .btn-buy-xs.disabled.active,
    .btn-buy-xs[disabled],
    .btn-buy-xs[disabled]:hover,
    .btn-buy-xs[disabled]:focus,
    .btn-buy-xs[disabled]:active,
    .btn-buy-xs[disabled].active {
        opacity: 1;
        background-color: #fff;
        border-color: #b8b8b8;
        color: #b8b8b8;
    }
    .btn-fixed-width {
        width: 90px;
    }
</style>
