import { Elysia, t } from "elysia";
import auth from "@/macros/auth";
import { JoinStatus, CreatorType } from "@/types/types";
import { type JoinResponse } from "@/types/response";
import prisma from "@/prisma";
import { randomUUID } from "node:crypto";
import crypto, { Ticket } from "@/util/crypto";
import arbiter from "@/util/arbiter";
import logger from "@/util/logger";
import { ArbiterNode } from "@prisma/client";
import ip from "@/util/ip";
import redis from "@/util/redis";
import config from "@/util/config";
import visitScript from "@assets/visit.lua?raw";

function createJoinScript(
  wsAddress: string = "",
  machineAddress: string = "127.0.0.1",
  machinePort: number = 53640,
  userName: string = "Player",
  userId: number = 1,
  placeId: number = 67,
  creatorId: number = 1,
  creatorType: CreatorType = CreatorType.User,
  universeId: number = 1,
  charAppUrl: string = "",
  jobId: string = "Test",
  ticket: boolean = false,
) {
  return {
    ClientPort: 0,
    WebSocketAddress: wsAddress,
    MachineAddress: machineAddress,
    ServerPort: machinePort,
    PingUrl: "",
    PingInterval: 120,
    UserName: userName,
    UserId: userId,
    ClientTicket: ticket
      ? crypto.makeClientTicket(userId, userName, jobId, charAppUrl)
      : "",
    PlaceId: placeId,
    BaseUrl: config.webserver.baseUrl,
    ChatStyle: "ClassicAndBubble",
    CreatorId: creatorId,
    CreatorTypeEnum: CreatorType[creatorType],
    MembershipType: "None",
    AccountAge: 365,
    IsRobloxPlace: false,
    UniverseId: universeId,
    GenerateTeleportJoin: false,
    SessionId: `${randomUUID()}|${randomUUID()}|0|127.0.0.1|8|${new Date().toISOString()}|0|null|null`,
    DataCenterId: 0,
    FollowUserId: 0,
    BrowserTrackerId: 0,
    UsePortraitMode: false,
    CharacterAppearance: charAppUrl,
  };
}

const game = new Elysia({ prefix: "/game" }).use(auth.as("scoped"));

game.get("/visit", ({ session }) => {
  return visitScript
    .replaceAll("%BASEURL%", config.webserver.baseUrl)
    .replaceAll("%USERID%", String(session?.User?.id ?? 0));
});

game.get("/get-current-user", ({ session }) => session?.User?.id);

game.get(
  "/join",
  async ({ query, set }) => {
    let ticket;
    try {
      ticket = JSON.parse(query.ticket ?? "") as Ticket;
      if (query.signature !== crypto.hmacHex(ticket)) throw Error();
    } catch (e) {
      return createJoinScript();
    }

    const gameserver = await prisma.gameserver.findFirst({
      where: {
        id: ticket.GameId,
        placeId: ticket.PlaceId,
      },
      include: {
        node: true,
        place: {
          include: { asset: true },
        },
      },
    });
    if (!gameserver) {
      set.status = 400;
      return { message: "Server not found" };
    }

    const {
      node: { https, url, port },
      place: {
        asset: { creatorId, creatorType },
      },
    } = gameserver;

    return createJoinScript(
      `${https ? "wss" : "ws"}://${url}:${port}/ws/${ticket.GameId}`,
      "127.0.0.1",
      53640,
      ticket.UserName,
      ticket.UserId,
      ticket.PlaceId,
      creatorId,
      creatorType,
      ticket.UniverseId,
      ticket.CharacterFetchUrl,
      ticket.GameId,
      true,
    );
  },
  {
    query: t.Object({
      ticketVersion: t.Optional(t.Number()),
      ticket: t.Optional(t.String()),
      signature: t.Optional(t.String({ minLength: 64, maxLength: 64 })),
    }),
  },
);

// * ---------- PlaceLauncher ----------
const reservedRanges = [
  /^10\./,
  /^127\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
  /^169\.254\./,
  /^::1$/,
  /^fc00:/,
  /^fe80:/,
  /^localhost$/,
  /^roblox.loc$/, // Don't fucking do this
];

game.post(
  "/placelauncher",
  async ({ query, user, set, request, session, server }) => {
    const { placeId, jobId, isTeleport, requestType, useGeolocation } = query;
    let response: JoinResponse;

    // get user's ip for geolocation
    let ipAddr: string | null = null;
    ipAddr = await ip.getAddress(request);

    // Find the place
    const place = await prisma.place.findFirst({
      where: { id: placeId },
    });

    if (!place) {
      response = {
        jobId: null,
        status: JoinStatus.Error,
        message: "Invalid place.",
        joinScriptUrl: null,
        authenticationTicket: null,
        authenticationUrl: "",
      };
      return response;
    }

    switch (requestType) {
      case "RequestGame":
        // ---------- RequestGame ----------
        // 1. If jobId is specified, check if that game server exists and return it
        // 2. If jobId not specified, check for any active game servers for this place, return if found
        // 3. If no game server exists, create a new one and return the join script and the jobId

        if (jobId) {
          // RequestGame stage 1
          try {
            const gameserver = await prisma.gameserver.findFirst({
              where: {
                id: jobId,
                placeId: placeId,
              },
              include: {
                players: true,
              },
            });

            if (!gameserver) {
              throw new Error("Invalid JobId.");
            }

            if (gameserver.players.length >= place.maxPlayerCount) {
              set.status = 400;
              response = {
                jobId: jobId,
                status: JoinStatus.GameFull,
                message: "Game is full.",
                joinScriptUrl: null,
                authenticationTicket: null,
                authenticationUrl: "",
              };
              return response;
            }

            const ticketRes = crypto.makeJoinTicket(
              user.id,
              user.username,
              jobId,
              Number(place?.id),
              Number(place?.universeId),
              isTeleport,
              null,
            );

            if (!ticketRes || !ticketRes.ticket || !ticketRes.signature) {
              throw new Error("Failed to generate ticket.");
            }

            const ticket = JSON.stringify(ticketRes.ticket);
            const signature = ticketRes.signature;

            set.status = 200;
            response = {
              jobId: jobId,
              status: JoinStatus.Joining,
              joinScriptUrl: `${config.webserver.baseUrl}/api/game/join?ticketVersion=2&ticket=${encodeURIComponent(ticket)}&signature=${encodeURIComponent(signature)}`,
              authenticationTicket: "",
              authenticationUrl: "",
            };
            return response;
          } catch (error: any) {
            set.status = error.message ? 400 : 500;
            response = {
              jobId: jobId,
              status: JoinStatus.Error,
              message: error.message || "Internal Server Error",
              joinScriptUrl: null,
              authenticationTicket: null,
              authenticationUrl: "",
            };
            return response;
          }
        } else {
          // RequestGame stage 2
          const availableGame = await prisma.gameserver.findFirst({
            orderBy: {
              players: { _count: "desc" },
            },
            where: {
              placeId: placeId,
            },
            include: {
              players: true,
              node: true,
            },
          });

          const sessionId = session?.Session?.id;
          let latLonData: { lat: number; lon: number } | null = null;
          try {
            const raw = await redis.get(`session:${sessionId}:latlon`);

            if (raw) {
              latLonData = JSON.parse(raw);
              logger.info(
                `Found cached latlon data for session ${sessionId}: ${raw}`,
              );
            } else {
              logger.info(
                `No cached latlon data for session ${sessionId}. Generating...`,
              );

              if (
                ipAddr &&
                useGeolocation &&
                !reservedRanges.some((range) => range.test(ipAddr))
              ) {
                const region = await ip.getData(ipAddr, [
                  "status",
                  "message",
                  "query",
                  "lat",
                  "lon",
                ]);

                if (
                  region &&
                  region.status === "success" &&
                  region.lat &&
                  region.lon
                ) {
                  latLonData = {
                    lat: region.lat,
                    lon: region.lon,
                  };
                  await redis.set(
                    `session:${sessionId}:latlon`,
                    JSON.stringify(latLonData),
                    "EX",
                    60 * 60 * 24 * 3, // 3 days
                  );
                  logger.info(
                    `Geolocated IP ${ipAddr} to latlon ${region.lat},${region.lon}`,
                  );
                } else {
                  logger.warn("Failed to geolocate IP");
                }
              } else {
                logger.warn(
                  `IP ${ipAddr} is reserved or geolocation is disabled.`,
                );
                latLonData = null;
              }
            }
          } catch (error) {
            logger.error(
              `Error accessing Redis for session ${sessionId}:`,
              error,
            );
          }

          if (
            availableGame &&
            availableGame.players.length !== place.maxPlayerCount &&
            availableGame.node &&
            !availableGame.isLoading &&
            (await arbiter.getAllNodes()).some(
              (n: any) => n.id === availableGame.node.id,
            ) // Is this server still in the Registry? (Is it healthy?)
          ) {
            const ticketRes = await crypto.makeJoinTicket(
              user.id,
              user.username,
              availableGame.id,
              Number(place?.id),
              Number(place?.universeId),
              isTeleport,
              null,
            );

            if (!ticketRes || !ticketRes.ticket || !ticketRes.signature) {
              set.status = 500;
              response = {
                jobId: null,
                status: JoinStatus.Error,
                message: "Failed to generate ticket.",
                joinScriptUrl: null,
                authenticationTicket: null,
                authenticationUrl: "",
              };
              return response;
            }

            const ticket = JSON.stringify(ticketRes.ticket);
            const signature = ticketRes.signature;

            set.status = 200;
            response = {
              jobId: availableGame.id,
              status: JoinStatus.Joining,
              joinScriptUrl: `${config.webserver.baseUrl}/api/game/join?ticketVersion=2&ticket=${encodeURIComponent(ticket)}&signature=${encodeURIComponent(signature)}`,
              authenticationTicket: "",
              authenticationUrl: "",
            };
            return response;
          } else {
            // RequestGame stage 3
            if (
              (await redis.exists(`creategame:${placeId}`)) ||
              availableGame?.isLoading
            ) {
              set.status = 200;
              response = {
                jobId: null,
                status: JoinStatus.Loading, // Instead of Waiting, we use Loading to show the client that we found a server and it's loading still
                joinScriptUrl: null,
                authenticationTicket: null,
                authenticationUrl: "",
              };
              return response;
            } else {
              // bg task
              set.status = 200;
              response = {
                jobId: null,
                status: JoinStatus.Waiting, // Waiting here because we are creating a new game server
                joinScriptUrl: null,
                authenticationTicket: null,
                authenticationUrl: "",
              };
              let node: ArbiterNode;
              try {
                node = arbiter.getNearestGameNode(latLonData);
              } catch (error) {
                logger.error(
                  `Failed to get available Arbiter node: ${error instanceof Error ? error.message : String(error)}`,
                );
                set.status = 503;
                response = {
                  jobId: null,
                  status: JoinStatus.Error,
                  message: "Failed to get available game server.",
                  joinScriptUrl: null,
                  authenticationTicket: null,
                  authenticationUrl: "",
                };
                return response;
              }
              redis.doWithLock(`creategame:${placeId}`, 10, async () => {
                try {
                  const gameserver = await arbiter.newGame(placeId, node);
                  return gameserver;
                } catch (error) {
                  logger.error(
                    `Failed to create new game server for place ${placeId}: ${error instanceof Error ? error.message : String(error)}`,
                  );
                }
              });
              return response;
            }
          }
        }

      case "RequestPrivateGame":
        // todo
        break;
    }
  },
  {
    auth: true,
    query: t.Object({
      placeId: t.Number({ minimum: 1, description: "Place ID" }),
      jobId: t.Optional(
        t.String({ description: "Unique ID for the game server" }),
      ),
      isTeleport: t.Boolean({ default: false }),
      requestType: t.Union(
        [t.Literal("RequestGame"), t.Literal("RequestPrivateGame")],
        { default: "RequestGame" },
      ),
      useGeolocation: t.Boolean({
        default: true,
        description: "Whether to find a game server closest to your IP address",
      }),
    }),
  },
);
export default game;
