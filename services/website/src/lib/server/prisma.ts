import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import config from "./util/config";

function convertBigIntToNumber(obj: unknown) {
  const transform = (value: unknown): unknown => {
    if (typeof value === "bigint") {
      return Number(value);
    } else if (value instanceof Date) {
      return value;
    } else if (Array.isArray(value)) {
      return value.map(transform);
    } else if (typeof value === "object" && value !== null) {
      return Object.fromEntries(
        Object.entries(value).map(([key, val]) => [key, transform(val)]),
      );
    }

    return value;
  };

  return transform(obj);
}

// https://github.com/prisma/prisma/issues/7570#issuecomment-1707368067
// this is very annoying

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: config.databaseUrl,
  }),
}).$extends({
  name: "bigintToNumber",
  query: {
    async $allOperations({ args, query }) {
      const result = await query(args);
      return convertBigIntToNumber(result);
    },
  },
});

export default prisma;
