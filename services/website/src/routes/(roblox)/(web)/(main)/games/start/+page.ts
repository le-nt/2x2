import { error } from '@sveltejs/kit';

export async function load({ url }) {
    const placeId = url.searchParams.get("placeId");
    if(!Number(placeId))
        error(400, "PlaceId is invalid")
    return { placeId };
}