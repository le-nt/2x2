/**
 * Basically, every single route
 */
// * Dependencies
import { Elysia } from "elysia";
// import { swagger } from "@elysiajs/swagger";
import { openapi } from "@elysiajs/openapi";
import logger from "@/util/logger";
import packageJson from "../../../../package.json";
import auth from "@/macros/auth";

// * Routes
import index from "./route";
import users from "@/api/users/route";
import asset from "@/api/asset/route";
import gameserver from "@/api/internal/gameserver/route";
import persistence from "@/api/persistence/route";
import universes from "@/api/universes/route";
import game from "@/api/game/route";
import games from "./games/route";
import admin from "./internal/admin/route";
import forums from "./forums/route";
import moderation from "./moderation/route";
import marketplace from "./marketplace/route";
import develop from "./develop/route";
import places from "./places/route";
import devProducts from "./developerproducts/route";
import badges from "./badges/route";
import thumbnail from "./thumbnail/route";
import sherlock from "./sherlock/route";
import intake from "./internal/intake-api/route";

const all = new Elysia();
all.use(auth); // this gives session to contexts in routes

const routes = [
  index,
  users,
  gameserver,
  intake,
  admin,
  persistence,
  universes,
  game,
  games,
  asset,
  forums,
  moderation,
  develop,
  marketplace,
  places,
  devProducts,
  badges,
  thumbnail,
  sherlock,
]; // routes to register

all.use(
  openapi({
    // exclude: excludedRegex,
    // ? Exclusions now happen within routes
    documentation: {
      info: {
        title: "Roblox API",
        version: packageJson.version,
      },
      components: {
        securitySchemes: {
          Auth: {
            type: "apiKey",
            in: "cookie",
            name: ".ROBLOSECURITY",
            description: "Authentication via .ROBLOSECURITY cookie",
          },
        },
      },
    },
  }),
);

for (const route of routes) {
  if (route instanceof Elysia) {
    all.use(route);
    if (route === asset) {
      logger.info(`Asset Delivery registered`);
    } else {
      logger.info(`Route ${route.config.prefix || "/"} added to registry`);
    }
  } else {
    logger.error(
      `Failed to register route: ${route}. Expected an instance of Elysia.`,
    );
  }
}

export default all;
