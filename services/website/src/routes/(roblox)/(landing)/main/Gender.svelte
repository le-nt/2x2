<script lang="ts">
    import { UserGender } from "@/types/types";

    let { gender = $bindable(), invalid = $bindable(), valid = $bindable() } = $props();
    
    function selectGender(value: UserGender) {
		gender = value;
	}
</script>

<div class="landing-form-control !flex flex-row box-border h-[46px]" class:invalid={invalid} class:valid={valid}>
    <span class="mt-1.5 text-[18px] block ml-2">Gender</span>
    <div class="flex flex-row w-full ml-16">
        <button
            class="gender-circle female mr-20"
            class:selected={gender === UserGender.Female}
            aria-label="Female"
            type="button"
            onclick={() => selectGender(UserGender.Female)}>
            <div></div>
        </button>
        <button
            class="gender-circle male"
            class:selected={gender === UserGender.Male}
            aria-label="Male"
            type="button"
            onclick={() => selectGender(UserGender.Male)}>
            <div></div>
        </button>
    </div>
</div>

<style>
    .gender-circle {
        display: flex;
        align-items: center;
        width: 30px;
        height: 30px;
        border-radius: 15px;
        border: 1px solid #B8B8B8;
        margin-top: 0;
        cursor: pointer;
        outline: none;
    }

    .male > div {
        background-image: url('/images/landing/male.png');
        background-position: 8px 0;
    }

    .female > div {
        background-image: url('/images/landing/female.png');
        background-position: 6.75px 0;
    }

    .male.selected {
        background-color: #fff;
        border: 1px solid #32B5FF;
    }

    .female.selected {
        background-color: #fff;
        border: 1px solid #D86868;
    }

    .male.selected > div {
        background-position: -22px 0;
    }

    .female.selected > div {
        background-position: -24px 0;
    }

    .male > div, .female > div {
        background-repeat: no-repeat;
        width: 28px;
        height: 100%;
        margin-top: 5px;
    }
</style>