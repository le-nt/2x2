import { api } from "@client/api";
import { encode } from "@client/url";
import { error, redirect } from "@sveltejs/kit";

export const load = async ({ params, fetch }) => {
    const placeId = Number(params.placeId);
    const game = await api.games.single.get(fetch, {
        query: { placeId }
    });
    if (game.error)
        error(404);

    const encodedName = encode(game.data.name);
    if (encodedName !== params.name)
        redirect(301, `/games/${placeId}/${encodedName}`);

    return { game: game.data };
}