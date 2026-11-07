import { Elysia, status, t } from "elysia";
import { AssetType, SessionValidationResult, UserGender } from "@/types/types";
import logger from "@/util/logger";
import users from "@/util/users";
import turnstile from "@/util/turnstile";
import config from "@/util/config";
import ip from "@/util/ip";
import auth from "@/macros/auth";
import prisma from "@/prisma";
import { escalationToUserFriendly } from "@shared/prisma-browser";
import { Escalation } from "@prisma/client";
import { AccountStatus } from "@/types/roblox";
import redis from "@/util/redis";

const api = new Elysia({ prefix: "/users" }).use(auth.as("scoped"));
api.use(auth);

api.post(
  "/create",
  async ({ set, body, cookie: { ".ROBLOSECURITY": auth }, request, server }) => {
    const captcha = await turnstile.validateTurnstile(body.turnstile_response);
    if (!captcha.success) {
      logger.warn(`Turnstile validation failed: ${JSON.stringify(captcha)}`);
      set.status = 400;
      return {
        success: false,
        error: "Invalid Turnstile/CAPTCHA response",
        code: 400,
        message: "Bad Request",
      };
    }

    logger.debug(`Making user ${body.username}`);
    const { username, password, invite, birthday, gender } = body;
    if (!Object.values(UserGender).includes(gender)) {
      set.status = 400;
      return {
        success: false,
        error: "Invalid gender value",
        code: 400,
        message: "Bad Request",
      };
    }

    // * We should add the creating user's IP as a seed (priority: CF-Connecting-IP, server?.requestIP(request))
    const ipAddr = (await ip.getAddress(request)) as string;
    const result = await users.createUser(
      username,
      password,
      invite ?? "",
      birthday,
      gender,
    );

    if (!result.User && result.Error) {
      logger.error(`Error creating user: ${result.Error}`);
      set.status = 400;
      return {
        success: false,
        error: result.Error,
        code: 400,
        message: "Bad Request",
      };
    }

    if (!result.User) {
      logger.error("Unknown error creating user.");
      set.status = 500;
      return {
        success: false,
        error: "Unknown error",
        code: 500,
        message: "Internal Server Error",
      };
    }

    logger.info(`User ${result.User.username} created successfully.`);
    // * Create a session for the user
    const token = users.generateSessionToken();
    await users.createSession(token, result.User.id, ipAddr);

    // * Set .ROBLOSECURITY
    auth.value = token;
    auth.httpOnly = true;
    auth.secure = true;
    auth.sameSite = "lax";
    auth.expires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14); // 14d

    set.status = 201;
    return {
      success: true,
      user: {
        id: result.User.id,
        username: result.User.username,
        createdAt: result.User.createdAt,
      },
      code: 0,
      message: "User created successfully",
    };
  },
  {
    // * Validation for the body
    body: t.Object({
      username: t.String(),
      password: t.String(),
      invite: t.Optional(t.String()),
      birthday: t.Date(),
      gender: t.Number(),
      turnstile_response: t.String(),
    }),
  },
);

api.post(
  "/login",
  async ({ set, body, cookie: { ".ROBLOSECURITY": auth }, request, server }) => {
    if (auth.cookie.value) {
      const value = auth.cookie.value;
      const sessionValidation: SessionValidationResult =
        await users.validateSession(value as string);
      if (sessionValidation.Session && sessionValidation.User) {
        logger.debug(
          `User ${sessionValidation.User.username} is already logged in.`,
        );
        set.status = 200;
        return {
          success: true,
          error: null,
          token: value,
          code: 0,
          message: "Already logged in",
        };
      } else {
        auth.remove();
        logger.debug(
          "User session is invalid or expired, logging out and proceeding...",
        );
      }
    }

    const captcha = await turnstile.validateTurnstile(body.turnstile_response);
    if (!captcha.success) {
      logger.warn(`Turnstile validation failed: ${JSON.stringify(captcha)}`);
      set.status = 400;
      return {
        success: false,
        error: "Invalid Turnstile/CAPTCHA response",
        code: 400,
        message: "Bad Request",
      };
    }

    logger.debug(`Logging in user ${body.username}`);
    const result = await users.validateLogin(body.username, body.password);
    if (!result.User && result.Error) {
      logger.error(`Error logging in user: ${result.Error}`);
      set.status = 400;
      return {
        success: false,
        error: result.Error,
        code: 400,
        message: "Bad Request",
      };
    }

    if (!result.User) {
      logger.error("Unknown error logging in user.");
      set.status = 500;
      return {
        success: false,
        error: "Unknown error",
        code: 500,
        message: "Internal Server Error",
      };
    }
    await prisma.user.update({
      where: { id: result.User.id },
      data: {
        lastLogin: new Date(),
      },
    });

    const ipAddr = (await ip.getAddress(request)) as string;
    // logger.info(`login ip: ${ipAddr}`);
    const token = users.generateSessionToken();
    await users.createSession(token, result.User.id, ipAddr);

    set.status = 200;
    auth.value = token;
    auth.httpOnly = true;
    auth.secure = true;
    auth.sameSite = "lax";
    auth.expires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14); // 14 days

    return {
      success: true,
      error: null,
      token: token,
      code: 0,
      message: "OK",
    };
  },
  {
    body: t.Object({
      username: t.String(),
      password: t.String(),
      turnstile_response: t.String(),
    }),
  },
);

api.get(
  "/:userId",
  async ({ params }) => {
    const user = await prisma.user.findUnique({
      where: { id: params.userId },
      select: {
        id: true,
        username: true,
        about: true,
        roleSet: true,
        createdAt: true,
        _count: {
          select: {
            forumThreads: true,
            forumPosts: true,
          },
        },
        assets: {
          where: { type: AssetType.Place },
          select: {
            id: true,
            name: true,
            description: true,
            place: {
              select: {
                visits: true,
                gameServers: {
                  select: { players: true },
                },
                likes: true,
                dislikes: true,
              },
            },
          },
        },
      },
    });
    if (!user) return status(404);
    return user;
  },
  {
    params: t.Object({
      userId: t.Number(),
    }),
  },
);

api.get("/my", async ({ cookie: { ".ROBLOSECURITY": auth } }) => {
  const value = auth.cookie.value as string;
  const user = await users.validateSession(value);

  return {
    success: user.Session !== null && user.User !== null,
    user: user.User
      ? {
        id: user.User.id,
        username: user.User.username,
        createdAt: user.User.createdAt,
      }
      : null,
    code: 0,
    error: null,
    message: "OK",
  };
}, {
  bannedAllowed: true
});

api.get("/my/banned", async ({ set, user }) => {
  const banData = await users.isBanned(user.id);
  if (!banData) {
    return {
      data: null
    }
  }

  const canReactivate = banData.action === Escalation.Warn || banData.action === Escalation.Remind || (banData.cannotReactivateUntil ? new Date() >= banData.cannotReactivateUntil : false);
  return {
    data: {
      banTypeUserFriendly: escalationToUserFriendly(banData.action),
      canReactivate,
      canReactivateAt: banData.cannotReactivateUntil,
      moderatorNote: banData.reason,
      reviewed: banData.date,
      isTermination: banData.action === Escalation.Delete
    }
  }
}, {
  auth: true,
  bannedAllowed: true
})

api.post("/my/reactivate", async ({ set, user }) => {
  const banData = await users.isBanned(user.id);
  if (!banData) {
    set.status = 400;
    return {
      success: false,
      error: "Not banned",
    }
  }

  if (banData.action === Escalation.Delete) {
    set.status = 400;
    return {
      success: false,
      error: "Your escalation is permanent",
    }
  }

  const canReactivate = banData.action === Escalation.Warn || banData.action === Escalation.Remind || (banData.cannotReactivateUntil ? new Date() >= banData.cannotReactivateUntil : false);
  if (!canReactivate) {
    set.status = 400;
    return {
      success: false,
      error: "You can't reactivate",
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: {
        accountStatus: AccountStatus.Ok,
      },
    });

    await tx.moderation.updateMany({
      where: { id: banData.id },
      data: {
        resolved: true,
      },
    });
  });

  if (await redis.get(`user:${user.id}:banned`)) {
    await redis.del(`user:${user.id}:banned`);
  }

  set.status = 200;
  return { success: true, error: null }
}, {
  auth: true,
  bannedAllowed: true
});


api.get("/log-out", async ({ cookie: { ".ROBLOSECURITY": auth, ".simulping": adminAuth }, redirect }) => {
  auth.remove();
  adminAuth.remove();
  return redirect("/")
}, {
  bannedAllowed: true
});

api.get(
  "/request-auth",
  async ({ cookie: { ".ROBLOSECURITY": authCookie } }) => {
    return `${config.webserver.baseUrl}/api/users/set-token?suggest=${authCookie.value}`;
  },
  { auth: true },
);

api.get(
  "/set-token",
  async ({ query, cookie: { ".ROBLOSECURITY": auth } }) => {
    auth.value = query.suggest;
    auth.httpOnly = true;
    auth.secure = true;
    auth.sameSite = "lax";
    auth.expires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
    return query.suggest;
  },
  {
    query: t.Object({
      suggest: t.String(),
    }),
  },
);

api.get(
  "/is-taken",
  async ({ query }) => {
    return users.isUsernameTaken(query.username);
  },
  {
    query: t.Object({
      username: t.String({ minLength: 3, maxLength: 20 }),
    }),
  },
);

api.get(
  "/validate-invite",
  async ({ query }) => {
    const exists = await prisma.invite.findUnique({
      where: { code: query.code },
    });
    return exists !== null;
  },
  {
    query: t.Object({
      code: t.String({ minLength: 1, maxLength: 200 }),
    }),
  },
);

export default api;
