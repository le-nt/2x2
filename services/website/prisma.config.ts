import { defineConfig, env } from "@prisma/config";
import config from "./src/lib/server/util/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: config.databaseUrl,
  },
});
