import { Elysia, status } from "elysia";
import users from "@/util/users";
import type { SessionValidationResult } from "@/types/types";
import logger from "@/util/logger";
import { UserAdminTrait } from "@prisma/client";
import ip from "@/util/ip";
import redis from "@/util/redis";

const plugin = new Elysia({ name: "auth" }).as("scoped")
    .derive(async ({ cookie: { ".ROBLOSECURITY": auth, ".simulping": adminauth } }) => {
        const cookieValue = auth?.cookie?.value;
        if (!cookieValue) {
            return { session: null };
        }
        const adminCookieValue = adminauth?.cookie?.value;
        const sessValidUser: SessionValidationResult = await users.validateSession(cookieValue as string);
        let adminValidUser: SessionValidationResult;
        if (adminCookieValue) {
            adminValidUser = await users.validateAdminSession(adminCookieValue as string, cookieValue as string);
        } else {
            adminValidUser = { Session: null, User: null };
        }
        return {
            session: sessValidUser,
            adminSession: adminValidUser,
            bannedAllowed: false as boolean,
        };
    })
    .macro({
        bannedAllowed: (allowed: boolean) => {
            return {
                resolve() {
                    return {
                        bannedAllowed: allowed as boolean,
                    };
                },
            };
        },
        auth: (requireAuth: boolean = false) => {
            return {
                resolve({ status, session }) {
                    if (!requireAuth) {
                        return;
                    }
                    if (!session?.User) {
                        return status(401);
                    }
                    return { user: session.User };
                },
                async beforeHandle({ set, session, bannedAllowed }) {
                    if (!requireAuth) return;
                    if (!session?.User) return;

                    const banned = await users.isBanned(session.User.id);
                    if (banned && bannedAllowed !== true) {
                        return status(403);
                    }
                }
            };
        },
        rateLimit: (settings: { maxRequests: number, limitSeconds: number }) => {
            return {
                async beforeHandle({ set, request, server, path, session }) {
                    const identifier = session?.User?.id ?? await ip.getAddress(request);
                    const key = `cooldown:${identifier}:${path}`
                    const current = await redis.incr(key);
                    if (current === 1 && settings.limitSeconds > 0) {
                        await redis.expire(key, settings.limitSeconds);
                    }
                    if (current > settings.maxRequests) {
                        set.status = 429;
                        return {
                            success: false,
                            error: "Too Many Requests",
                            code: 429,
                            message: "You have hit the rate limit"
                        }
                    }
                },
            };
        },
        admin: (minimumRequiredTrait: UserAdminTrait) => {
            return {
                async beforeHandle({ set, session, adminSession }) {
                    const user = session?.User;
                    if (!user) {
                        logger.debug("Admin: User is not authenticated.");
                        set.status = 401;
                        return {
                            success: false,
                            error: "Unauthorized",
                            code: 401,
                            message: "You must be logged in to access this resource.",
                        };
                    }

                    const trait = user.roleSet;
                    if (!trait) {
                        logger.debug(`Admin: User ${user.username} does not have an admin trait.`);
                        set.status = 403;
                        return {
                            success: false,
                            error: "Forbidden",
                            code: 403,
                            message: "You do not have permission to access this resource.",
                        };
                    }

                    if (!adminSession?.User) {
                        set.status = 403;
                        return {
                            success: false,
                            error: "Forbidden",
                            code: 403,
                            message: "TOTP required",
                        }
                    }

                    if (!users.hasHigherTrait(trait, minimumRequiredTrait)) {
                        logger.debug(`Admin: User ${user.username} does not have the required admin trait.`);
                        set.status = 403;
                        return {
                            success: false,
                            error: "Forbidden",
                            code: 403,
                            message: "You do not have permission to access this resource.",
                        };
                    }
                },
            };
        }
    });

export default plugin;

