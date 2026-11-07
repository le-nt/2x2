import { Elysia, t } from "elysia";

const intake = new Elysia({ prefix: "/internal/intake-api", detail: {hide: true} });
export default intake;