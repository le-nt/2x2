<script>
    let { isInitial } = $props();
</script>

{#if isInitial}
    <li class="list-item feed-game">
        <a class="list-header" href="/games" aria-label="Games Page">
            <span class="icon-games"></span>
        </a>
        <div class="list-body">
            <h2>Play Games</h2>
            <p class="list-content">Nearly all ROBLOX games are built by players like you. Here are some of our favorites:</p>
        </div>
    </li>
    <li class="list-item feed-creation">
        <a class="list-header" href="/my/character.aspx" aria-label="Avatar Page">
            <span class="icon-charactercustomizer"></span>
        </a>
        <div class="list-body">
            <h2>Customize Your Character</h2>
            <p class="list-content">Visit the <a href="/my/character.aspx"> Character page </a> to customize your character. Get new clothing in the <a href="/catalog/browse.aspx?CatalogContext=1&amp;Subcategory=1&amp;CreatorID=1&amp;CurrencyType=0&amp;pxMin=0&amp;pxMax=0&amp;SortType=4&amp;SortAggregation=3&amp;SortCurrency=0&amp;IncludeNotForSale=false&amp;LegendExpanded=true&amp;Category=1">catalog</a></p>
            <ul class="list-gallery">
                <li><img src="/images/005a0f4d764d9c609ff4c37a2bb99006.png" alt="ROBLOX Avatar"></li>
                <li><img src="/images/e861c0c517df63e9f17e96685cc4bb14.png" alt="ROBLOX Avatar"></li>
                <li><img src="/images/7fd0bef40b29834e8add92234b352c3e.png" alt="ROBLOX Avatar"></li>
                <li><img src="/images/294ebb9ceaac3c5352de0ebecab909ec.png" alt="ROBLOX Avatar"></li>
            </ul>
        </div>
    </li>
    <li class="list-item feed-creation">
        <a class="list-header" href="/develop" aria-label="Develop Page">
            <span class="icon-develop"></span>
        </a>
        <div class="list-body">
            <h2>Build Something</h2>
            <p class="list-content">Builders will enjoy playing our multiplayer building game. Professional builders will want to check out ROBLOX Studio, our game development environment on your <a href="/develop">Develop page</a>.</p>
        </div>
    </li>
    <li class="list-item feed-social">
        <a class="list-header" href="/search/users" aria-label="User Search Page">
            <span class="icon-friends"></span>
        </a>
        <div class="list-body">
            <h2>Make Friends</h2>
            <p class="list-content">Meet other players in-game and send them a friend request. If you miss your opportunity you can always send a request later by <a href="/search/users">searching</a> for their user profile.</p>
        </div>
    </li>
{/if}

<style>
    .list-item {
        border-top: 1px solid #E3E3E3;
        display: block;
        padding: 0;
        padding-top: 12px;
        margin-bottom: 12px;
        display: flex;
    }

    .feed-game {
        border-top: 2px solid #02b757 !important;
    }

    .feed-creation {
        border-top: 2px solid #f68802 !important;
    }

    .feed-social {
        border-top: 2px solid #00a2ff !important;
    }

    .list-body {
        margin-left: 10px;
    }

    .list-content {
        margin: 3px 0px;
        font-size: 16px;
    }

    .list-header > .icon-games {
        background-position: 0 -60px;
    }

    .list-header > .icon-charactercustomizer {
        background-position: 0 -120px;
    }

    .list-header > .icon-develop {
        background-position: 0 -60px;
    }

    .list-header > .icon-friends {
        background-position: 0 -120px;
    }

    .list-gallery {
        display: flex;
        justify-content: space-between;
        padding-left: 0;
        margin-right: 40px;
    }

    .feed-game span[class^="icon"], .feed-creation span[class^="icon"], .feed-social span[class^="icon"] {
        background-size: 200% auto;
        width: 60px;
        height: 60px;
    }
</style>