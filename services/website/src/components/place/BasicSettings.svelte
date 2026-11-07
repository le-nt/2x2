<script lang="ts">
	import { AssetGenre } from "@/types/types";

	let { 
		name = $bindable(""), 
		description = $bindable(""), 
		genre = $bindable(AssetGenre.All) 
	} = $props();
</script>

<h3 class="text-3xl font-medium mb-2">Basic Settings</h3>

<div class="mb-2">
	<p class="mb-1 font-semibold text-[15px]">Name:</p>
	<input
		class="text-box text-box-medium"
		style="width: 400px"
		minlength="1"
		maxlength="30"
		type="text"
		bind:value={name}
	/>
</div>

<div class="mb-2">
	<p class="mb-1 font-semibold text-[15px]">Description:</p>
	<textarea
		class="text-box text-area-medium"
		style="width: 400px"
		minlength="1"
		maxlength="1000"
		rows="6"
		bind:value={description}
	></textarea>
</div>

<div>
	<p class="font-semibold text-[15px]">Genre:</p>
	<select
		class="form-select font-normal mt-[5px] mr-0 ml-0"
		bind:value={genre}
	>
		<option value={AssetGenre.All}>All</option>
		<option value={AssetGenre.Adventure}>Adventure</option>
		<option value={AssetGenre.Building}>Building</option>
		<option value={AssetGenre.Comedy}>Comedy</option>
		<option value={AssetGenre.Fighting}>Fighting</option>
		<option value={AssetGenre.FPS}>FPS</option>
		<option value={AssetGenre.Horror}>Horror</option>
		<option value={AssetGenre.Medieval}>Medieval</option>
		<option value={AssetGenre.Military}>Military</option>
		<option value={AssetGenre.Naval}>Naval</option>
		<option value={AssetGenre.RPG}>RPG</option>
		<option value={AssetGenre.SciFi}>Sci-Fi</option>
		<option value={AssetGenre.Sports}>Sports</option>
		<option value={AssetGenre.TownAndCity}>Town and City</option>
		<option value={AssetGenre.Western}>Western</option>
	</select>
</div>