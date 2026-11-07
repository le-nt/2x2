<script lang="ts">
    interface Props {
        class?: string;
        values: Record<string, any>;
        btnClass?: string;
        current: any;
    }

    let {
        class: additionalClasses = "",
        btnClass = "",
        current = $bindable(),
        values,
        ...rest
    }: Props = $props();
    let isDropdownOpen = $state(false);

    function handleDropdownClick() {
        isDropdownOpen = !isDropdownOpen;
    }

    function handleDropdownFocusLoss(event: FocusEvent) {
        const { relatedTarget, currentTarget } = event;
        if (
            relatedTarget instanceof HTMLElement &&
            currentTarget instanceof HTMLElement &&
            currentTarget.contains(relatedTarget)
        )
            return;
        isDropdownOpen = false;
    }

    function getKeyByValue<T>(obj: Record<string, T>, value: T): string | undefined {
        return Object.keys(obj).find(key => obj[key] === value);
    }
</script>

<div class="w-full z-[501] {additionalClasses}" onfocusout={handleDropdownFocusLoss} {...rest}>
    <button class="dropdown-btn flex flex-row {btnClass}" onclick={handleDropdownClick}>
        <span>{getKeyByValue(values, current)}</span>
        <span class="icon-down-16x16 block ml-auto mt-0.5"></span>
    </button>
    <ul
        class="dropdown-menu"
        style:visibility={isDropdownOpen ? "visible" : "hidden"}
    >
        {#each Object.entries(values) as [key, value]}
            <li>
                <button
                    onclick={() => {
                        current = value;
                        isDropdownOpen = false;
                    }}
                >
                    {key}
                </button>
            </li>
        {/each}
    </ul>
</div>


<style>
    .dropdown-btn {
        user-select: none;
        border: 1px solid transparent;
        background-color: #fff;
        border-color: #B8B8B8;
        color: #191919;
        cursor: pointer;
        font-weight: 300;
        height: auto;
        transition: all,0.2s,ease-in-out;
        white-space: nowrap;
        padding: 9px 12px;
        margin: 0;
        line-height: 18px;
        width: 100%;
    }

    .dropdown-btn:hover, .dropdown-btn:focus {
        box-shadow: none;
    }
    
    .dropdown-btn:hover, .dropdown-btn:focus {
        background-color: #00A2FF;
        box-shadow: 0 1px 3px rgba(150,150,150,0.74);
        border-color: #00A2FF;
        color: #fff;
        cursor: pointer;
    }

    .dropdown-menu {
        background-color: #fff;
        box-shadow: 0 -5px 20px rgba(25,25,25,0.15);
        margin: 0;
        padding: 0;
        min-width: 105px;
        overflow-y: auto;
        overflow-x: hidden;
        width: calc(100% + 25px);
    }
    
    .dropdown-menu li {
        margin: 0;
        padding: 0;
        white-space: nowrap;
        width: 100%;
    }

    .dropdown-menu li button {
        display: block;
        font-weight: 500;
        padding: 10px 10px;
        width: 100%;
    }

    .dropdown-menu li:hover {
        box-shadow: 4px 0 0 0 #00A2FF inset;
        cursor: pointer;
    }
</style>