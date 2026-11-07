import { Elysia, t } from "elysia";
import modUtil from "@/util/moderation";

const moderation = new Elysia({
    prefix: "/moderation", detail: {
        hide: true
    }
});
moderation.post("/filtertext", async ({ body }) => {
    const filtered = await modUtil.filterText(body.text);
    return {
        success: true,
        message: "",
        data: {
            AgeUnder13: filtered,
            Age13OrOver: filtered,
        },
    }
}, {
    body: t.Object({
        text: t.String({ maxLength: 50 })
    })
});

export default moderation