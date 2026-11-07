/**
 * Users and Auth management
 */

import { getRandomValues } from "crypto";
import {
  encodeBase32UpperCaseNoPadding,
  encodeHexLowerCase,
} from "@oslojs/encoding";
import { sha256 } from "@oslojs/crypto/sha2";
import { v4 as uuidv4 } from "uuid";
import type {
  SessionValidationResult,
  UserCreateResult,
  UserLoginResult,
} from "@/types/types";
import { Session, Invite, User, UserAdminTrait, Escalation, Moderation } from "@prisma/client";
import { AccountStatus } from "@/types/roblox";
import { UserGender } from "@/types/types";
import crypto from "./crypto";
import config from "./config";
import logger from "./logger";
import prisma from "@/prisma";
import ipUtil from "./ip";
import redis from "./redis";
import features from "./features";
import arbiter from "./arbiter";
import { userAdminTraitRank } from "@shared/prisma-browser";

const traitRank = userAdminTraitRank;

async function deleteExpiredSessions() {
  const now = new Date();
  logger.info("Deleting expired sessions...");
  try {
    await prisma.session.deleteMany({
      where: {
        expiresAt: {
          lte: now,
        },
      },
    });
    await prisma.adminSession.deleteMany({
      where: {
        expiresAt: {
          lte: now,
        },
      },
    });
  } catch (error) {
    logger.error("Error deleting expired sessions: " + String(error));
  }
}
await deleteExpiredSessions();
setInterval(async () => {
  await deleteExpiredSessions();
}, 1000 * 60 * 60);

function hasHigherTrait(
  userTrait: UserAdminTrait,
  requiredTrait: UserAdminTrait,
): boolean {
  return traitRank[userTrait] >= traitRank[requiredTrait];
}

function generateSessionToken(admin: boolean = false): string {
  const bytes = new Uint8Array(128);
  getRandomValues(bytes);
  const token = admin
    ? `${encodeBase32UpperCaseNoPadding(bytes)}`
    : `_|WARNING:-DO-NOT-SHARE-THIS.--Sharing-this-will-allow-someone-to-log-in-as-you-and-to-steal-your-currency-and-items.|_${encodeBase32UpperCaseNoPadding(bytes)}`;
  return token;
}

async function createSession(token: string, userId: number, ip?: string) {
  const session: Session = {
    id: encodeHexLowerCase(sha256(new TextEncoder().encode(token))),
    userId,
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14),
  };

  const expiry = new Date(Date.now() + 1000 * 60 * 60 * 24 * 90); // ? 90d, 3 months
  if (ip) {
    const { encrypted, hash } = await ipUtil.encryption.encryptIP(ip);
    const exists = await prisma.ip.findFirst({
      where: {
        contentHash: hash,
        expiresAt: {
          gt: new Date(),
        }
      },
      include: {
        users: {
          select: { id: true }, // * Optimize your queries ladies and gentlemen
        }
      }
    });
    if (!exists) {
      await prisma.ip.create({
        data: {
          content: encrypted,
          contentHash: hash,
          expiresAt: expiry,
          banned: false,
          users: {
            connect: { id: userId },
          },
        },
      });
    } else if (exists && !exists.users.some(u => u.id === userId)) {
      await prisma.ip.update({
        where: {
          id: exists.id,
        },
        data: {
          users: {
            connect: { id: userId },
          },
          lastSeen: new Date(),
          expiresAt: expiry,
        },
      });
    } else {
      //? "already exists and is linked to this user, just update lastSeen and expiresAt"
      await prisma.ip.update({
        where: {
          id: exists.id,
        },
        data: {
          lastSeen: new Date(),
          expiresAt: expiry,
        },
      });
    }
  }

  await prisma.session.create({
    data: session,
  });
  return session;
}

async function createAdminSession(token: string, userId: number) {
  const sessionId = encodeHexLowerCase(sha256(new TextEncoder().encode(token)));
  const session: Session = {
    id: sessionId,
    userId,
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 6),
  };
  await prisma.adminSession.create({
    data: session,
  });
  return session;
}

async function validateLogin(
  username: string,
  password: string,
): Promise<UserLoginResult> {
  const user = await prisma.user.findFirst({
    where: {
      username: {
        equals: username,
        mode: "insensitive",
      },
    },
  });
  if (!user) {
    return {
      User: null,
      Error:
        "Your username or password is incorrect. Please check them and try again.",
    };
  }

  const isPasswordValid = Bun.password.verifySync(password, user.password);
  if (!isPasswordValid) {
    return {
      User: null,
      Error:
        "Your username or password is incorrect. Please check them and try again.",
    };
  }

  return { User: user };
}

async function validateSession(
  token: string,
): Promise<SessionValidationResult> {
  const sessionId = encodeHexLowerCase(sha256(new TextEncoder().encode(token)));

  const cacheHit = await redis.get(`session:${sessionId}`);
  if (cacheHit) {
    const session = JSON.parse(cacheHit);

    if (Date.now() >= new Date(session.expiresAt).getTime()) {
      await redis.del(`session:${sessionId}`);
      return { Session: null, User: null };
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
    });

    if (!user) return { Session: null, User: null };

    return { Session: session, User: user };
  }

  const result = await prisma.session.findUnique({
    where: { id: sessionId },
  });

  if (result === null) {
    return { Session: null, User: null };
  }

  if (Date.now() >= result.expiresAt.getTime()) {
    await prisma.session.delete({ where: { id: sessionId } });
    return { Session: null, User: null };
  }

  if (Date.now() >= result.expiresAt.getTime() - 1000 * 60 * 60 * 24 * 15) {
    result.expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
    await prisma.session.update({
      where: { id: result.id },
      data: { expiresAt: result.expiresAt },
    });
  }

  await redis.set(
    `session:${sessionId}`,
    JSON.stringify({
      id: result.id,
      expiresAt: result.expiresAt,
      userId: result.userId,
    }),
    "EX",
    Math.floor((result.expiresAt.getTime() - Date.now()) / 1000),
  );

  const user = await prisma.user.findUnique({
    where: { id: result.userId },
  });

  if (!user) return { Session: null, User: null };

  return {
    Session: {
      id: result.id,
      expiresAt: result.expiresAt,
      userId: result.userId,
    },
    User: user,
  };
}

async function validateAdminSession(
  token: string,
  roblosecurity: string,
): Promise<SessionValidationResult> {
  const sessionId = encodeHexLowerCase(sha256(new TextEncoder().encode(token)));
  const result = await prisma.adminSession.findUnique({
    where: {
      id: sessionId,
    },
    include: {
      user: true,
    },
  });
  const resultUser = await validateSession(roblosecurity);
  if (resultUser.Session === null || resultUser.User === null) {
    return { Session: null, User: null };
  }
  if (result === null) {
    return { Session: null, User: null };
  }
  if (result.user.id !== resultUser.User.id) {
    logger.warn(
      `Admin session validation failed: User ID mismatch. Session User ID: ${result.user.id}, Provided User ID: ${resultUser.User.id}`,
    );
    return { Session: null, User: null };
  }
  const { user, ...session } = result;
  if (Date.now() >= session.expiresAt.getTime()) {
    await prisma.adminSession.delete({ where: { id: sessionId } });
    return { Session: null, User: null };
  }
  return { Session: session, User: user };
}

async function deleteSession(token: string): Promise<void> {
  const sessionId = encodeHexLowerCase(sha256(new TextEncoder().encode(token)));
  await prisma.session.delete({
    where: {
      id: sessionId,
    },
  });
}

async function deleteAllSessionsForUser(userId: number): Promise<void> {
  await prisma.session.deleteMany({
    where: {
      userId: userId,
    },
  });
}

async function createInviteCode(): Promise<Invite> {
  const code = `roblox_${uuidv4()}`;
  const invite: Invite = await prisma.invite.create({
    data: {
      code: code,
      used: false,
      usedBy: null,
    },
  });
  return invite;
}

async function extendSession(token: string): Promise<Session | null> {
  const sessionId = encodeHexLowerCase(sha256(new TextEncoder().encode(token)));
  const session = await prisma.session.findUnique({
    where: {
      id: sessionId,
    },
  });
  if (!session) {
    return null;
  }
  const newExpiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14);
  await prisma.session.update({
    where: {
      id: sessionId,
    },
    data: {
      expiresAt: newExpiresAt,
    },
  });
  return {
    ...session,
    expiresAt: newExpiresAt,
  };
}

async function createUser(
  username: string,
  password: string,
  invite: string,
  birthday: Date,
  gender: UserGender,
): Promise<UserCreateResult> {
  const invitesEnabled = config.webserver.isTestWebsite;
  // 1. Check if sign up is enabled
  if (!(await features.isFeatureEnabled("signUpEnabled"))) {
    return { User: null, Error: "Sign up is disabled." };
  }
  // 2. Check date isn't in future
  if (birthday > new Date()) {
    return { User: null, Error: "You're not a time traveller" };
  }
  // 2.1. Check user is over the age of thirteen
  const age = new Date(Date.now() - birthday.getTime()).getUTCFullYear() - 1970;
  if (age < 13) {
    logger.warn("UnderThirteenError!!!");
    return { User: null, Error: "Unable to sign up." }; // UnderThirteenError
  }

  // 3. Check username requirements and availability and check the password isn't less than 6 characters
  if (!password || password.length < 6) {
    return { User: null, Error: "Password must be at least 6 characters." };
  }

  const existingUser = await prisma.user.findUnique({
    where: {
      username: username,
    },
  });
  if (!username || username.length < 3 || username.length > 20) {
    return {
      User: null,
      Error: "Username must be between 3 and 20 characters.",
    };
  }
  if (!/^[a-zA-Z0-9_ ]+$/.test(username) || /^\s|\s$/.test(username)) {
    return {
      User: null,
      Error:
        "Username can only contain letters, numbers, underscores, and spaces. Spaces cannot be leading or trailing.",
    };
  }

  // 4. Check the invite code if enabled
  if (invitesEnabled) {
    const inviteCode = await prisma.invite.findUnique({
      where: {
        code: invite,
      },
    });
    if (!inviteCode || inviteCode.used) {
      return { User: null, Error: "Invalid beta code, or beta code already used." };
    }
    if (existingUser) {
      return { User: null, Error: "Username already in use." };
    }
  }

  // 5. Sign up the user - all checks have passed, right?
  let user: User;
  try {
    const hashed = Bun.password.hashSync(password);
    user = await prisma.user.create({
      data: {
        username: username,
        password: hashed,
        birthday: birthday,
        gender: gender,
        roleSet: UserAdminTrait.Unprivileged,
      },
    });

    // 6. Mark the invite as used if enabled
    if (invitesEnabled) {
      await prisma.invite.update({
        where: {
          code: invite,
        },
        data: {
          used: true,
          usedBy: user.id,
        },
      });
    }

    // 7. Dispatch a render for the user
    const charApp = await getCharacterAppearanceString(user.id);
    try {
      if (charApp) {
        const hash = crypto.sha256Hex(charApp);
        await arbiter.newAvatarDispatchment(user.id, hash, false);
        await arbiter.newAvatarDispatchment(user.id, hash, true);
      }
    } catch (error) {
      logger.warn(
        `Avatar dispatch failed for user ${user.id}: ${String(error)}`,
      );
    }
  } catch (error) {
    logger.error("uh oh - " + error);
    return { User: null, Error: "Failed to create user. Please try again." };
  }

  // 7. Return the created user
  return { User: user };
}

async function isUsernameTaken(username: string): Promise<boolean> {
  let f = username.trim().toLowerCase();
  const user = await prisma.user.findFirst({
    where: { username: f },
  });
  return user !== null;
}

async function getCharacterAppearanceString(
  id: number,
  includeBodyColors: boolean = true,
): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      accoutrements: {
        include: {
          userInventory: true,
        },
      },
    },
  });
  if (!user) return null;

  const assetIDs: number[] = [];
  for (const accoutrement of user.accoutrements) {
    assetIDs.push(Number(accoutrement.userInventory.assetId));
  }

  const accoutrementUrls = assetIDs
    .map((id) => `${config.webserver.baseUrl}/api/asset?id=${id}`)
    .join(";");

  if (includeBodyColors) {
    return `${config.webserver.baseUrl}/api/asset/xmlbodycolors?userId=${id};${accoutrementUrls}`;
  } else {
    return accoutrementUrls;
  }
}

async function isBanned(userId: number): Promise<Moderation | false> {
  const cached = await redis.get(`user:${userId}:banned`);
  if (cached !== null) {
    if (cached === "false") return false;
    const data = JSON.parse(cached);
    data.date = new Date(data.date);
    if (data.cannotReactivateUntil) data.cannotReactivateUntil = new Date(data.cannotReactivateUntil);
    return data;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      accountStatus: true,
      latestModeration: true
    }
  });
  if (!user) return false;
  const statusOk = user.accountStatus === AccountStatus.Ok // TODO: if there's any statuses that arent OK but arent bans
  const latestMod = user.latestModeration;
  let result: Moderation | false = false;
  if (!statusOk) {
    if (latestMod === null || latestMod.action === Escalation.Unban) {
      await prisma.user.update({
        where: { id: userId },
        data: { accountStatus: AccountStatus.Ok }
      });
      result = false; // * How the hell does this happen?
    } else {
      if (!latestMod.resolved) {
        result = latestMod;
      }
    }
  }

  if (result) {
    await redis.set(`user:${userId}:banned`, JSON.stringify(result), "EX", 60 * 30);
  } else {
    await redis.set(`user:${userId}:banned`, "false", "EX", 60 * 30);
  }
  return result;
}

export default {
  hasHigherTrait,
  createAdminSession,
  validateAdminSession,
  generateSessionToken,
  createSession,
  validateSession,
  extendSession,
  deleteSession,
  deleteAllSessionsForUser,
  createUser,
  validateLogin,
  createInviteCode,
  isUsernameTaken,
  getCharacterAppearanceString,
  isBanned
};
