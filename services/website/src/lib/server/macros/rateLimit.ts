import { Elysia } from "elysia";
import logger from "@/util/logger";
import config from "@/util/config";

const plugin = new Elysia({ name: "plugin" })
    .macro({
        rateLimit: (requireAccessKey: boolean = false) => {
            return {
                async beforeHandle({ headers, set }) {
                    if (!requireAccessKey)
                        return;

                    const key = headers["accesskey"]
                    if (!key) {
                        set.status = 401;
                        return {
                            success: false,
                            code: 401,
                            error: "Unauthorized",
                            message: "AccessKey required"
                        }
                    }

                    if (key !== config.webserver.assetAccessKey) {
                        logger.debug("Access key invalid")
                        set.status = 401;
                        return {
                            success: false,
                            code: 401,
                            error: "Unauthorized",
                            message: "AccessKey required"
                        }
                    }

                    logger.debug("Pass");
                },
            };
        },
    });

export default plugin; 