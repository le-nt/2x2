import { Elysia, t } from "elysia";
import auth from "@/macros/auth";
import prisma from "@/prisma";
import redis from "@/util/redis";

const sherlock = new Elysia({ prefix: "/sherlock", detail: { hide: true } }).use(auth.as("scoped"));

sherlock.post(
  "/report",
  async ({ body, set, user }) => {
    const { data, code } = body;

    if (code) {
      if (code === "tundra") { // webgl off
        return { success: true }; // TODO: log that!!!! thats hella suspicious
      }

      set.status = 400;
      return;
    }

    if (!data) {
      set.status = 400;
      return { error: "missing data" };
    }
    await prisma.fingerprint.upsert({
      where: { fingerprint: data },
      update: {
        users: { connect: { id: user.id } }
      },
      create: {
        fingerprint: data,
        users: { connect: { id: user.id } }
      }
    });

    return { success: true };
  },
  {
    body: t.Object({
      data: t.Optional(t.Nullable(t.String({
        pattern: '^[a-fA-F0-9]{64}$',
        error: "invalid data"
      }))),
      code: t.Optional(t.String()),
    }),
    auth: true,
    rateLimit: { maxRequests: 10, limitSeconds: 60 },
  },
);

export default sherlock;