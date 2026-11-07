import crypto from "crypto";
import { encryptString, decryptString } from "@47ng/cloak";
import { GeolocateResult } from "@/types/types";
import config from "./config";
import logger from "./logger";
import prisma from "@/prisma"
import { Ip } from "@prisma/client";

// const headersToCheck = [
//     "x-real-ip", // Nginx proxy/FastCGI
//     "x-client-ip", // Apache https://httpd.apache.org/docs/2.4/mod/mod_remoteip.html#page-header
//     "cf-connecting-ip", // Cloudflare
//     "fastly-client-ip", // Fastly
//     "x-cluster-client-ip", // GCP
//     "x-forwarded", // General Forwarded
//     "forwarded-for", // RFC 7239
//     "forwarded", // RFC 7239
//     "x-forwarded", // RFC 7239
//     "appengine-user-ip", // GCP
//     "true-client-ip", // Akamai and Cloudflare
//     "cf-pseudo-ipv4", // Cloudflare
//     "fly-client-ip", // Fly.io
// ]

const headersToCheck = [
    "x-forwarded-for", // PASS THIS FROM CADDY PLEASE
]

let cachedBannedIps: Ip[] = [];
let bannedIpSet = new Set<string>();

async function refresh() {
    logger.info("Refreshing banned IP cache...");
    try {
        cachedBannedIps = await prisma.ip.findMany({
            where: {
                expiresAt: {
                    gt: new Date()
                },
                banned: true
            }
        });
        logger.info(`Refreshed banned IP cache with ${cachedBannedIps.length} entries`);
        bannedIpSet = new Set(cachedBannedIps.map(ip => ip.contentHash));
    } catch (error) {
        logger.error("Failed to refresh banned IP cache:", error);
    }
}

async function gdprRemoveExpiredIps() {
    logger.info("Checking for expired IPs...");
    try {
        const { count } = await prisma.ip.deleteMany({
            where: {
                expiresAt: {
                    lte: new Date()
                },
                banned: false
            }
        });

        if (count > 0) {
            logger.info(`Removed ${count} expired IPs`);
        } else {
            logger.warn("No expired IPs found to remove");
        }
    } catch (error) {
        logger.error("Failed to remove expired IP bans:", error);
    }
}

function fetchBannedIps(): Ip[] {
    return cachedBannedIps;
}

function has(hash: string): boolean {
    return bannedIpSet.has(hash);
}

const bannedIpCache = { fetch: fetchBannedIps, has, refresh };
await bannedIpCache.refresh();
await gdprRemoveExpiredIps();
setInterval(gdprRemoveExpiredIps, 5 * 60 * 1000);  // every 5 minutes

const key = config.encryption.ipEncryptionKey;
const ipSalt = config.encryption.ipSalt;

async function encryptIP(ip: string): Promise<{ encrypted: string; hash: string }> {
    const encrypted = await encryptString(ip, key);
    const hash = hashIP(ip);
    return { encrypted, hash };
}

async function decryptIP(encrypted: string): Promise<string> {
    return await decryptString(encrypted, key);
}

function hashIP(ip: string): string {
    return crypto.createHash("sha256").update(ipSalt + ip).digest("hex");
}

async function getAddress(request: Request): Promise<string | null> {
    const xForwardedFor = request.headers.get("X-Forwarded-For");
    if (xForwardedFor) {
        return xForwardedFor.split(",")[0].trim();
    }

    let clientIP: string | null = null;
    for (const header of headersToCheck) {
        clientIP = request.headers.get(header);
        if (clientIP)
            break;
    }

    return clientIP ?? "127.0.0.1";
}

async function getData<T extends (keyof GeolocateResult)[]>(
    address: string,
    fields: T
): Promise<Pick<GeolocateResult, T[number]> | null> {
    const res = await fetch(`http://ip-api.com/json/${address}?fields=${fields.join(",")}`);
    if (!res.ok)
        return null;
    return res.json();
}

const encryption = { encryptIP, decryptIP, hashIP };
export default { getAddress, getData, encryption, bannedIpCache };