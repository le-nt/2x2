// * Functions for interacting with Roblox
import config from "@/util/config";
import logger from "@/util/logger";

async function api<T>(url: string): Promise<T | null> {
    const res = await fetch(url, {
        headers: {
            "User-Agent": "Roblox/WinInet",
            cookie: `.ROBLOSECURITY=${config.roblox.auth}`
        },
    })
    if (!res.ok) {
        logger.error(`Failed to fetch Roblox API with status code ${res.status}`)
        return null;
    }

    const data = await res.json();
    if (data.errors !== undefined) {
        logger.error(`Roblox API returned errors: ${data.errors}; Path: ${url}`)
        return null;
    }

    return data;
}

export default { api }