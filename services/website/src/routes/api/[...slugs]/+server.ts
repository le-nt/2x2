import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { version } from "../../../../package.json";
import config from "@/util/config";
import allRoutes from "@/api/all";
import ipBanMiddleware from "@/middleware/ipban";

const app = new Elysia({
  prefix: "/api",
  cookie: { secrets: config.encryption.secureCookies },
  serve: { idleTimeout: 90 },
})
  .use(
    cors({
      origin: config.webserver.corsAllowed,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    }),
  )
  .onBeforeHandle(ipBanMiddleware)
  .onBeforeHandle(({ set }) => {
    set.headers["Server"] = `2x2/${version}`;
  })
  .use(allRoutes);

export type App = typeof app;
type RequestHandler = (v: { request: Request }) => Response | Promise<Response>;

export const GET: RequestHandler = ({ request }) => app.handle(request);
export const POST: RequestHandler = ({ request }) => app.handle(request);
export const DELETE: RequestHandler = ({ request }) => app.handle(request);
export const PUT: RequestHandler = ({ request }) => app.handle(request);
export const OPTIONS: RequestHandler = ({ request }) => app.handle(request);