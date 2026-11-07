import { Context } from "elysia";
import logger from "@/util/logger";
import ipUtil from "@/util/ip";

const ipBanMiddleware = async (context: Context) => {
    const ip = await ipUtil.getAddress(context.request);
    const hashedIp = ip ? ipUtil.encryption.hashIP(ip) : null;
    if (hashedIp) {
        const isBanned = ipUtil.bannedIpCache.has(hashedIp);
        if (isBanned) {
            logger.warn(`Blocked request from banned IP: ${ip}`);
            context.set.status = 403;
            context.set.headers["content-type"] = "text/plain";
            // * Intentionally, we are very vague. We just send off a 403 and are done with it, honestly. 
            return new Response(null, { status: 403 });
        }
    }

    // * Not banned, have a nice day :)
    return;
};

export default ipBanMiddleware;