import { Elysia, t } from "elysia";

const badges = new Elysia({ prefix: "/badges" });

badges.get(
    "/list-badges-for-place/json",
    () => {
        return {
            GameBadges: [],
            FinalPage: true,
            PageSize: 1000,
        };
    },
    {
        query: t.Object({
            placeId: t.Number()
        }),
        auth: true
    }
);

export default badges;