import { Elysia } from "elysia";

const index = new Elysia();
index.get("/", ({set, server, request}) => {
    set.status = 200;
    return {
        success: true,
        error: null,
        code: 0,
        message: "OK",
        // ipaddr: server?.requestIP(request)?.address,
    }
})

export default index;