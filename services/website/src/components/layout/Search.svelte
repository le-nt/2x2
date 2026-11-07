<script>
    let searchTerm = $state("");
    let isSearchFocused = $state(false);
    let selectedIndex = $state(0);
</script>

<div class="hidden sm:block mt-[6px] col-xs-5 col-sm-6 col-md-3 relative pr-8" onfocusin={() => isSearchFocused = true} onfocusout={() => isSearchFocused = false}>
    <input 
        class="search-field w-full h-[24px] rounded-[3px]" 
        type="text" 
        placeholder="Search" 
        maxlength="120"
        bind:value={searchTerm}
    >

    <button class="text-[#757575] absolute right-0 top-0.2" aria-label="Search" type="submit">
        <span class="icon-nav-search"></span>
    </button>

    {#if searchTerm && isSearchFocused}
        <ul class="absolute !top-[29px] max-w-[99%] dropdown-menu">
            {#each ["People", "Games", "Catalog", "Groups", "Library"] as section, i}
                <li 
                    class:selected={selectedIndex === i}
                    onmouseenter={() => selectedIndex = i}
                >
                    <span class="text-[16px] !py-[12px]">Search "{searchTerm}" in {section}</span>
                </li>
            {/each}
        </ul>
    {/if}
</div>

<style>
    .search-field {
        border: 1px solid #B8B8B8;
        border-right-width: 1px;
        border-right-style: solid;
        border-right-color: rgb(184, 184, 184);
        color: #191919;
        font-weight: 300;
        font-size: 16px;
        padding-left: 12px;
        box-sizing: border-box;
        height: 28px;
    }

    .dropdown-menu {
        background-color: #fff;
        border-radius: 3px;
        background-clip: padding-box;
        box-shadow: 0 -5px 20px rgba(25, 25, 25, 0.15);
        float: left;
        font-size: 16px;
        margin: 0;
        padding: 0;
        position: absolute;
        min-width: 105px;
        overflow-y: auto;
        overflow-x: hidden;
        width: 100%;
        top: 100%;
        left: 0;
        list-style: none;
        text-align: left;
        z-index: 1020;
    }

    .dropdown-menu li {
        margin: 0;
        padding: 0;
        white-space: nowrap;
        width: 100%;
        padding: 0 6px;
    }

    .dropdown-menu li span {
        padding: 10px 12px;
        display: block;
        font-weight: 300;
    }

    .dropdown-menu li span {
        clear: both;
        display: block;
        line-height: 1.25;
        padding: 10px 6px;
        white-space: nowrap;
    }

    .dropdown-menu li.selected {
        box-shadow: 4px 0 0 0 #00A2FF inset;
        cursor: pointer;
    }
</style>