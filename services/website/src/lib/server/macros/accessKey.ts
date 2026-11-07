import { Elysia } from "elysia";
import logger from "@/util/logger";
import config from "@/util/config";
import ip from "@/util/ip";
import redis from "@/util/redis";

const plugin = new Elysia({ name: "plugin" })
    .macro({
        accessKey: (maxRequests: number, limitSeconds = 0) => {
            return {
                async beforeHandle({ request, path, server }) {
                    const ipAddr = await ip.getAddress(request);
                    const key = `cooldown:${ip}:${path}`

                },
            };
        },
    });

export default plugin;