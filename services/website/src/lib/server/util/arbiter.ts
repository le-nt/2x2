import { AssetType } from "@/types/types";
import axiosLib from "axios";
import logger from "@/util/logger";
import prisma from "@/prisma";
import { ArbiterNode, Asset } from "@prisma/client";
import { getDimensions, ImageType, ThumbnailType } from "@/types/thumb";
import { ArbiterNodeStatus, StatResponse } from "@/types/types";
import config from "@/util/config";
import https from "https";
import haversine from "haversine-distance";
import ip from "./ip";
import redis from "./redis";

let Registry: ArbiterNode[] = [];

const agent = new https.Agent({
	rejectUnauthorized: false,
});

const axios = axiosLib.create({
	timeout: 5000,
	headers: {
		"User-Agent": "Roblox/Internal",
	},
	httpsAgent: agent,
});

async function geolocateNode(node: ArbiterNode) {
	if (node.lat && node.lon) return node;

	let ipToGeolocate = node.url;
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
		/^roblox.loc$/,
	];

	if (reservedRanges.some((rx) => rx.test(node.url))) {
		try {
			const ipifyRes = await axios.get("http://api.ipify.org/");
			ipToGeolocate = ipifyRes.data;
		} catch (error) {
			logger.warn(`Failed to get public IP for local node ${node.id}`);
		}
	}

	try {
		const region = await ip.getData(ipToGeolocate, ["status", "lat", "lon"]);
		if (region?.status === "success" && region.lat && region.lon) {
			await prisma.arbiterNode.update({
				where: { id: node.id },
				data: { lat: region.lat, lon: region.lon },
			});
			node.lat = region.lat;
			node.lon = region.lon;
		}
	} catch (error) {
		logger.warn(`Geolocation error for node ${node.id}: ${error}`);
	}
	return node;
}

async function checkNodeHealth(node: ArbiterNode): Promise<ArbiterNode> {
	const protocol = node.https ? "https" : "http";
	const url = `${protocol}://${node.url}${node.port ? `:${node.port}` : ""}/health`;

	try {
		await axios.get(url, { timeout: 5000, httpsAgent: agent });
		node.heartbeatAt = new Date();
		node.status = ArbiterNodeStatus.Online;
	} catch (error) {
		node.heartbeatAt = new Date(0);
		node.status = ArbiterNodeStatus.Offline;
	}
	return node;
}

async function runHeartbeatCycle() {
	let nodes = await prisma.arbiterNode.findMany({
		where: { maintenanced: false },
	});

	nodes = await Promise.all(nodes.map(geolocateNode));
	nodes = await Promise.all(nodes.map(checkNodeHealth));

	await Promise.all(
		nodes.map((n) =>
			prisma.arbiterNode.update({
				where: { id: n.id },
				data: { heartbeatAt: n.heartbeatAt, status: n.status },
			}),
		),
	);

	const activeNodes = nodes.filter((n) => n.status === ArbiterNodeStatus.Online);
	Registry = activeNodes;
	return activeNodes;
}

(async () => {
	try {
		await runHeartbeatCycle();
	} catch (e) {
		logger.error(`Arbiter init error: ${e}`);
	}

	while (true) {
		await new Promise((r) => setTimeout(r, 30000));
		try {
			await runHeartbeatCycle();
		} catch (e) {
			logger.error(`Arbiter loop error: ${e}`);
		}
	}
})();

async function getAllNodes(): Promise<ArbiterNode[]> {
	if (Registry.length === 0) {
		await runHeartbeatCycle();
	}
	return Registry;
}

async function getAllNodesFromDb(): Promise<ArbiterNode[]> {
	try {
		const nodes = await prisma.arbiterNode.findMany();
		return nodes.map((node) => ({
			...node,
			heartbeatAt: node.heartbeatAt ? new Date(node.heartbeatAt) : new Date(0),
		}));
	} catch (error) {
		logger.error(
			`Failed to fetch arbiter nodes from database: ${error instanceof Error ? error.message : String(error)}`,
		);
		throw error;
	}
}

function getNearestGameNode(
	userGeoData: { lat: number; lon: number } | null,
): ArbiterNode {
	const gameNodes = Registry.filter((n) => n.gameserver === true);
	if (!gameNodes.length)
		throw new Error(
			"Getting nearest game node failed, no Arbiter nodes with gameserver available",
		);
	if (
		!userGeoData ||
		typeof userGeoData.lat !== "number" ||
		typeof userGeoData.lon !== "number"
	) {
		const rand = Math.floor(Math.random() * gameNodes.length);
		return gameNodes[rand];
	}
	let min = Infinity,
		nearest: ArbiterNode | null = null;
	for (const n of gameNodes) {
		if (!n.lat || !n.lon) continue;
		const d = haversine(userGeoData, { lat: n.lat, lon: n.lon });
		if (d < min) ((min = d), (nearest = n));
	}
	if (!nearest)
		throw new Error(
			"Getting nearest game node failed, no Arbiter nodes with lat/lon available",
		);
	return nearest;
}

function getRenderNode(): ArbiterNode {
	// Just return a random node from the registry with 'renderer' marked as TRUE
	const renderNodes = Registry.filter((n) => n.renderer === true);
	if (!renderNodes.length)
		throw new Error(
			"Getting render node failed, no Arbiter nodes with renderer available",
		);
	const rand = Math.floor(Math.random() * renderNodes.length);
	return renderNodes[rand];
}

async function getNodeStats(nodeId: string): Promise<StatResponse> {
	const node = Registry.find((n) => n.id === nodeId);
	if (!node) {
		throw new Error(`Node with ID ${nodeId} not found`);
	}

	const protocol = node.https ? "https" : "http";
	const url = `${protocol}://${node.url}/stats`;

	try {
		const response = await axios.get(url, { timeout: 5000, httpsAgent: agent });
		return response.data as StatResponse;
	} catch (error) {
		logger.error(
			`Failed to fetch stats for node ${nodeId}: ${error instanceof Error ? error.message : String(error)}`,
		);
		throw error;
	}
}

type NewGameResponse = {
	success: boolean;
	message: string;
	job_id: string | null;
};

type NewRenderResponse = {
	success: boolean;
	message?: string;
};

// * Dispatchments are locks in Redis for rendering on that Asset.
async function newAvatarDispatchment(
	userId: number,
	characterAppearanceHash: string,
	bust: boolean,
	width?: number,
	height?: number,
) {
	const node = getRenderNode();
	const imageType = bust ? ImageType.AvatarHeadShot : ImageType.Avatar;

	const sizes = getDimensions(imageType);
	let dimensions: { width: number; height: number }[];

	if (width != null && height != null) {
		dimensions = [{ width, height }];
	} else {
		dimensions = sizes;
	}

	for (const dim of dimensions) {
		const key = `rendering:avatar${bust ? "Bust" : ""}:${dim.width}x${dim.height}:${characterAppearanceHash}`;
		if (await redis.exists(key)) {
			logger.info(
				`Avatar dispatchment already exists for user ${userId}, hash ${characterAppearanceHash}, size ${dim.width}x${dim.height}`,
			);
			return;
		}
		await redis.set(key, "1", "EX", 90);
	}

	const protocol = node.https ? "https" : "http";
	const url = `${protocol}://${node.url}${node.port ? `:${node.port}` : ""}/rendering/dispatch-avatar`;
	const headers = {
		AccessKey: config.webserver.assetAccessKey,
		"Content-Type": "application/json",
	};

	const res = await axios.post(
		url,
		{
			user_id: userId,
			hash: characterAppearanceHash,
			format: "Png",
			bust: bust,
			sizes: dimensions,
		},
		{ headers, httpsAgent: agent },
	);

	if (res.status !== 200) {
		logger.error(
			`Failed to dispatch avatar render for user ${userId}, hash ${characterAppearanceHash}, ${res.statusText}`,
		);
		throw new Error(`Failed to dispatch avatar render: ${res.statusText}`);
	}

	const json = res.data as NewRenderResponse;
	if (!json.success) {
		logger.error(`Error creating new render request`);
		throw new Error(`Failed to create new render request: ${res.statusText}`);
	}
}

function getArbiterThumbnailTypeFromAsset(asset: Asset): ThumbnailType {
	switch (asset.type) {
		case AssetType.Face:
			return ThumbnailType.Face;
		case AssetType.Decal:
			return ThumbnailType.Decal;
		case AssetType.Gear:
			return ThumbnailType.Gear;
		case AssetType.Hat:
			return ThumbnailType.Hat;
		case AssetType.Head:
			return ThumbnailType.Head;
		case AssetType.MeshPart:
			return ThumbnailType.MeshPart;
		case AssetType.Mesh:
			return ThumbnailType.Mesh;
		case AssetType.Model:
			return ThumbnailType.Model;
		case AssetType.Package:
			return ThumbnailType.Package;
		case AssetType.Pants:
			return ThumbnailType.Pants;
		case AssetType.Place:
			return ThumbnailType.Place;
		case AssetType.Shirt:
			return ThumbnailType.Shirt;
		default:
			throw new Error(`Unsupported asset type for thumbnail: ${asset.type}`);
	}
}

async function newAssetDispatchment(
	assetVersionIdGlobal: number,
	width?: number,
	height?: number,
): Promise<void> {
	const assetVersion = await prisma.assetVersion.findUnique({
		where: { id: assetVersionIdGlobal },
		include: {
			asset: {
				include: {
					place: {
						include: {
							universe: true,
						},
					},
				},
			},
		},
	});
	if (!assetVersion) {
		throw new Error(`Asset version (GLOBAL) ${assetVersionIdGlobal} not found`);
	}

	const asset = assetVersion.asset;
	const mannequinOrUniverseId =
		asset.place?.universe && asset.type === AssetType.Place
			? asset.place.universeId
			: 1785197;

	const node = getRenderNode();
	const allSizes = getDimensions(
		asset.place?.universe ? ImageType.Asset : ImageType.Game,
	);

	const dimensions: { width: number; height: number }[] =
		width != null && height != null
			? [{ width, height }]
			: Object.values(allSizes).map((size) => ({ ...size }));

	for (const dim of dimensions) {
		const key = `rendering:assetVersion:${assetVersionIdGlobal}:${dim.width}x${dim.height}`;
		if (await redis.exists(key)) {
			return;
		}
		await redis.set(key, "1", "EX", 180);
	}

	const protocol = node.https ? "https" : "http";
	const url = `${protocol}://${node.url}${node.port ? `:${node.port}` : ""}/rendering/dispatch-asset`;
	const headers = {
		AccessKey: config.webserver.assetAccessKey,
		"Content-Type": "application/json",
	};

	const thumbnailType = getArbiterThumbnailTypeFromAsset(asset);
	const res = await axios.post(
		url,
		{
			asset_id: asset.id,
			global_version_id: assetVersion.id,
			format: "Png",
			thumbnail_type: thumbnailType,
			mannequin_or_universe_id: mannequinOrUniverseId,
			sizes: dimensions,
		},
		{ headers, httpsAgent: agent },
	);

	if (res.status !== 200) {
		throw new Error(`Failed to dispatch ASSET render: ${res.statusText}`);
	}

	const json = res.data as NewRenderResponse;
	if (!json.success) {
		logger.error(`Error creating new render request`);
		throw new Error(`Failed to create new render request: ${res.statusText}`);
	}
}

async function newGame(place_id: number, node: ArbiterNode) {
	const protocol = node.https ? "https" : "http";
	const url = `${protocol}://${node.url}${node.port ? `:${node.port}` : ""}/gameserver/new`;

	const data = { place_id };
	const headers = {
		AccessKey: config.webserver.assetAccessKey,
		"Content-Type": "application/json",
	};

	const request = {
		method: "POST",
		url: url,
		headers: headers,
		data: data,
	};

	try {
		const response = await axios({
			...request,
			httpsAgent: agent,
		});
		if (response.status !== 200) {
			throw new Error(
				`Failed to create new gameserver: ${response.statusText}`,
			);
		}
		const data = response.data as NewGameResponse;
		if (!data.success) {
			throw new Error(`Failed to create new gameserver: ${data.message}`);
		}
		if (!data.job_id) {
			throw new Error("Failed to create new gameserver: jobId is null");
		}
		if (!data.job_id || typeof data.job_id !== "string") {
			throw new Error("Invalid jobId received from Arbiter node");
		}
		if (!node.id || typeof node.id !== "string") {
			throw new Error("Invalid nodeId");
		}
		if (typeof place_id !== "number" || isNaN(place_id)) {
			throw new Error("Invalid placeId");
		}
		await prisma.gameserver.create({
			data: {
				id: data.job_id,
				nodeId: node.id,
				placeId: place_id,
			},
		});
		logger.info(
			`New game server dispatched successfully on node ${node.id} for place ${place_id}. Job ID: ${data.job_id}`,
		);
	} catch (error) {
		logger.error(
			`Failed to create new game server on node ${node.id}: ${error instanceof Error ? error.message : String(error)}`,
		);
		throw error;
	}
}

async function renewLease(jobId: string, node: ArbiterNode, lease: number) {
	if (!Registry.find((n) => n.id === node.id)) {
		throw new Error("Node is unhealthy or deregistered");
	}

	const protocol = node.https ? "https" : "http";
	const url = `${protocol}://${node.url}${node.port ? `:${node.port}` : ""}/gameserver/renew-lease`;

	const headers = {
		AccessKey: config.webserver.assetAccessKey,
		"Content-Type": "application/json",
	};

	const body = {
		job_id: jobId,
		lease: lease,
	};

	const req = await axios.post(url, body, { headers, httpsAgent: agent });
	if (req.status !== 200) {
		logger.error(
			`Failed to renew lease for job ${jobId} on node ${node.id}: ${req.statusText}`,
		);
		throw new Error(`Failed to renew lease`);
	}

	logger.info(`Successfully renewed lease for job ${jobId} on node ${node.id}`);
}

async function reportShutdown(jobId: String, node: ArbiterNode) {
	const protocol = node.https ? "https" : "http";
	const url = `${protocol}://${node.url}${node.port ? `:${node.port}` : ""}/gameserver/reported-closed`;
	const headers = {
		AccessKey: config.webserver.assetAccessKey,
		"Content-Type": "application/json",
	};

	await axios.post(url, { job_id: jobId }, { headers });
	logger.info(`Reported shutdown for job ${jobId} on node ${node.id}`);
}

async function newValidationDispatchment(id: number) {
	const node = getRenderNode();
	const protocol = node.https ? "https" : "http";
	const url = `${protocol}://${node.url}${node.port ? `:${node.port}` : ""}/dispatch-validation`;

	const response = await fetch(url, {
		method: "POST",
		headers: {
			AccessKey: config.webserver.assetAccessKey,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({ asset_id: id }),
	});
	if (!response.ok) {
		console.error(
			`Validation failed: ${response.status} ${response.statusText}`,
		);
		return false;
	}
	return true;
}

export default {
	getAllNodes,
	getAllNodesFromDb,
	getNearestGameNode,
	getRenderNode,
	getNodeStats,
	// getGlobalStats,
	newGame,
	newAvatarDispatchment,
	newAssetDispatchment,
	renewLease,
	reportShutdown,
	newValidationDispatchment,
};
