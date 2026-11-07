<script lang="ts">
    import { onMount, onDestroy, tick } from 'svelte';
	import Button from '@components/Button.svelte';
	import Card from './Card.svelte';
	import { api } from '@client/api';
	import { type Game } from '@/types/response';

	interface Props {
		categoryName: string;
		categoryId: string;
	}
	let { categoryName, categoryId }: Props = $props();

    let games: Game[] = $state([]);
	let container: HTMLDivElement;
	let viewport: HTMLDivElement;

	let currentPage = $state(1);
	let isLoading = $state(false);
	let currentLeft = $state(0);
    let lastPage = $state(0);

	const CARD_WIDTH = 158;
	const CARD_MARGIN = 8;
	const CARD_TOTAL = CARD_WIDTH + CARD_MARGIN;

    let canScrollLeft = $state(false);
    let canScrollRight = $state(false);

    function updateScrollButtons() {
        if (!container || !viewport) return;

        const viewportWidth = viewport.clientWidth;
        const contentWidth = container.scrollWidth;
        const maxScrollLeft = contentWidth - viewportWidth;

        const scrolledAmount = -currentLeft;
        canScrollLeft = scrolledAmount > 0;

        const remainingScroll = maxScrollLeft - scrolledAmount;
        canScrollRight = remainingScroll > 5 || currentPage < lastPage;
    }

    function moveRight() {
        if (!container || !viewport || isLoading) return;

        fetchMoreIfNeeded();
        const viewportWidth = viewport.clientWidth;
        const contentWidth = container.scrollWidth;
        const maxLeft = -(contentWidth - viewportWidth);

        const cardsInViewport = Math.floor(viewportWidth / CARD_TOTAL);
        let targetLeft = currentLeft - CARD_TOTAL * cardsInViewport;

        if (targetLeft < maxLeft) targetLeft = maxLeft;

        currentLeft = targetLeft;
        updateScrollButtons();
    }

    function moveLeft() {
        if (!viewport) return;

        const viewportWidth = viewport.clientWidth;
        const cardsInViewport = Math.floor(viewportWidth / CARD_TOTAL);
        let targetLeft = currentLeft + CARD_TOTAL * cardsInViewport;

        if (targetLeft > 0) targetLeft = 0;

        currentLeft = targetLeft;
        updateScrollButtons();
    }

	async function fetchMoreIfNeeded() {
		if (!viewport || isLoading) return;

		const viewportWidth = viewport.clientWidth;
		const cardsInViewport = Math.ceil(viewportWidth / CARD_TOTAL);

		// if we don’t have enough cards to fill another scroll, fetch
		const remainingCards = games.length - Math.ceil(-currentLeft / CARD_TOTAL) - cardsInViewport;
		if (remainingCards < cardsInViewport * 2) {
			isLoading = true;
			try {
				const { data: newGames, error } = await api.games.sort.get(fetch, {
					query: {
						sortType: categoryId,
						page: currentPage + 1,
						pageSize: cardsInViewport * 2
					}
				});
				if (error) {
					console.error(error.value);
					return;
				}
				if (newGames?.result?.length) {
					currentPage++;
					games = [...games, ...newGames.result];
                    lastPage = newGames.lastPage;
				}
			} finally {
				isLoading = false;
			}
		}
	}

	async function fetchInitial() {
		await tick();
		if (!viewport) return;

		const cardsInViewport = Math.ceil(viewport.clientWidth / CARD_TOTAL);
		isLoading = true;

		try {
			const { data: newGames, error } = await api.games.sort.get(fetch, {
				query: {
					sortType: categoryId,
					page: 1,
					pageSize: cardsInViewport * 2
				}
			});
			if (error) {
				console.error(error.value);
				return;
			}
			if (newGames) {
				games = newGames.result;
                lastPage = newGames.lastPage;
			}
		} finally {
			isLoading = false;
		}
	}

    let resizeObserver: ResizeObserver | null = $state(null);
    onMount(async () => {
        await fetchInitial();
        updateScrollButtons();
        if (viewport) {
            resizeObserver = new ResizeObserver(() => {
                tick().then(fetchMoreIfNeeded).finally(updateScrollButtons);
            });
            resizeObserver.observe(viewport);
        }
    });

    onDestroy(() => {
        resizeObserver?.disconnect();
    });
</script>

<div class="relative flex flex-col !mt-[-35px]">
	<div class="flex flex-row items-start">
		<h3 class="mt-auto">{categoryName}</h3>
		<Button class="ml-auto" size="xs" type="secondary" text="See All" />
	</div>

	<div bind:this={viewport} class="relative w-full mt-[6px] overflow-hidden min-h-[283px]">
		<div
			bind:this={container}
			class="absolute whitespace-nowrap min-h-[164px] transition-all duration-[400ms] ease-linear"
			style="left: {currentLeft}px;"
		>
			{#each games as game}
				<Card
					id={game.id}
					name={game.name}
					playing={game.players}
					likes={game.likes}
					dislikes={game.dislikes}
					creatorName={game.creatorName}
					creatorUrl={`/users/${game.creatorId}/profile`}
                    class="mr-[8px]"
				/>
			{/each}
		</div>

		<button
			class="scroller left-0"
			aria-label="Scroll Previous"
			onclick={moveLeft}
			class:hidden={!canScrollLeft}
		>
			<span class="icon-games-carousel-left opacity-[.5]"></span>
		</button>
		<button
			class="scroller right-0"
			aria-label="Scroll Next"
			onclick={moveRight}
			class:hidden={!canScrollRight}
		>
			<span class="icon-games-carousel-right opacity-[.5]"></span>
		</button>
	</div>
</div>

<style>
	.scroller {
		position: absolute;
		user-select: none;
		background-color: rgba(255, 255, 255, 0.6);
		height: 160px;
		width: 30px;
		zoom: 1;
		z-index: 500;
		border-radius: 0 3px 3px 0;
		box-shadow: 0 0 3px 0 #ccc;
		top: 0;
	}

	.scroller:hover {
		zoom: 1;
		cursor: pointer;
	}

	.scroller:disabled {
		opacity: 0.3;
		cursor: default;
		border: 1px solid #e3e3e3;
	}

	@media (min-width: /*480*/0px) {
		.scroller {
			height: 220px;
		}
	}
</style>