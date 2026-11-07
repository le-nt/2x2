import { Elysia, t } from "elysia";

const devProducts = new Elysia({ prefix: "/developerproducts" });

devProducts.get(
    "/list",
    () => {
        return {
            DeveloperProducts: [],
            FinalPage: true,
            PageSize: 1000,
        };
    },
    {
        query: t.Object({
            universeId: t.Number(),
            page: t.Number()
        }),
        auth: true
    }
);

export default devProducts;