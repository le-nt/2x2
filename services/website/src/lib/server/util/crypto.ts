import logger from "./logger";
import config from "./config";
import { createHmac, createHash } from "node:crypto"

function sha256Hex(data: ArrayBuffer | Buffer | string) {
    return createHash("sha256")
        .update(data instanceof ArrayBuffer ? Buffer.from(data) : data)
        .digest("hex");
}

function hmacHex(data: object | string) {
    const hmac = createHmac("sha256", config.webserver.secretKey);
    hmac.update(typeof data === "string" ? data : JSON.stringify(data));
    return hmac.digest("hex");
}

export type Ticket = {
    UserId: number;
    UserName: string;
    CharacterFetchUrl: string;
    GameId: string; // jobid
    PlaceId: number;
    UniverseId: number;
    IsTeleport: boolean;
    FollowUserId: number | null;
    TimeStamp: string; // 8/9/2016 9:20:24 PM
    CharacterAppearanceId: number;
}

function ticketDateFormat(): string {
    const now = new Date();
    return now.toLocaleString("en-US", {
        month: "numeric",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "numeric",
        second: "numeric",
        hour12: true
    });
}

function makeClientTicket(userId: number, username: string, jobId: string, charAppUrl: string) {
    const timeStamp = ticketDateFormat();
    const preAuthenticateTicket = `${userId}\n${jobId}\n${timeStamp}`;
    const installPlayerTicket = `${userId}\n${username}\n${charAppUrl}\n${jobId}\n${timeStamp}`;
    return `${timeStamp};${hmacHex(preAuthenticateTicket)};${hmacHex(installPlayerTicket)}`
}

function makeJoinTicket(userId: number, username: string, jobId: string, placeId: number, universeId: number, isTeleport: boolean, followUserId: number | null) {
    try {
        const characterFetchUrl = `${config.webserver.baseUrl}/api/asset/character-fetch?userId=${userId}&placeId=${placeId}`;
        const timeStamp = ticketDateFormat();
        const characterAppearanceId = userId;

        const ticket: Ticket = {
            UserId: userId,
            UserName: username,
            CharacterFetchUrl: characterFetchUrl,
            GameId: jobId,
            PlaceId: placeId,
            UniverseId: universeId,
            IsTeleport: isTeleport,
            FollowUserId: followUserId,
            TimeStamp: timeStamp,
            CharacterAppearanceId: characterAppearanceId
        };

        return { ticket, signature: hmacHex(ticket), error: null };
    } catch (error) {
        logger.error(`Failed to create ticket: ${error instanceof Error ? error.message : String(error)}`);
        return { ticket: null, signature: null, error: error instanceof Error ? error.message : String(error) };
    }
}

export default { sha256Hex, hmacHex, makeJoinTicket, makeClientTicket };