import { Elysia, t } from "elysia";
import { Escalation, ForumCategory, Invite, UserAdminTrait } from "@prisma/client";
import { AccountStatus } from "@/types/roblox";
import assets from "@/util/assets";
import auth from "@/macros/auth";
import prisma from "@/prisma";
import logger from "@/util/logger";
import { CreatorType, SessionValidationResult } from "@/types/types";
import { authenticator } from "otplib";
import qrcode from "qrcode";
import ipUtil from "@/util/ip";
import users from "@/util/users";
import arbiter from "@/util/arbiter";
import featUtil from "@/util/features";
import redis from "@/util/redis";
import { AssetType } from "@/types/types";
import config from "@/util/config";

const allowedCatalogMigrationTypes = [
	AssetType.Hat,
]

const getApprovedStatus = (user: { accountStatus: number, latestModeration: { resolved: boolean, cannotReactivateUntil: Date | null, action: Escalation } | null }) => {
	const statusOk = user.accountStatus === AccountStatus.Ok;
	const latestMod = user.latestModeration;
	if (!statusOk) {
		if (latestMod === null || latestMod.action === Escalation.Unban) {
			return true;
		}
		const now = new Date();
		if (!latestMod.resolved) {
			if (latestMod.action === Escalation.Delete || latestMod.cannotReactivateUntil === null) {
				return false;
			} else if (now < latestMod.cannotReactivateUntil) {
				return false;
			}
		}
	}
	return true;
};

const calculateDuration = (action: Escalation): Date | null => {
	const now = new Date();
	switch (action) {
		case Escalation.Unban:
		case Escalation.Warn:
		case Escalation.Remind:
		case Escalation.Delete:
		default:
			return null;
		case Escalation.Ban_1Day:
			return new Date(now.setDate(now.getDate() + 1));
		case Escalation.Ban_3Day:
			return new Date(now.setDate(now.getDate() + 3));
		case Escalation.Ban_7Day:
			return new Date(now.setDate(now.getDate() + 7));
		case Escalation.Ban_14Day:
			return new Date(now.setDate(now.getDate() + 14));
		// case Escalation.Ban_183Day:
		// 	return new Date(now.setDate(now.getDate() + 183));
		// case Escalation.Ban_365Day:
		// 	return new Date(now.setDate(now.getDate() + 365));
	}
};

const calculateModerationStatus = (action: Escalation): AccountStatus => {
	switch (action) {
		case Escalation.Unban:
		default:
			return AccountStatus.Ok
		case Escalation.Remind:
		case Escalation.Warn:
		case Escalation.Ban_1Day:
		case Escalation.Ban_3Day:
		case Escalation.Ban_7Day:
		case Escalation.Ban_14Day:
			// case Escalation.Ban_183Day:
			// case Escalation.Ban_365Day:
			return AccountStatus.Suppressed;
		case Escalation.Delete:
			return AccountStatus.Deleted;
	}
};

authenticator.options = {
	window: 1,
};

const admin = new Elysia({
	prefix: "/admin", detail: {
		hide: true,
	}
}).use(auth.as("scoped"));

admin.get("/dash", async () => {
	const cached = await redis.get("admin:dash");
	if (cached) {
		return JSON.parse(cached);
	}

	const userCount = await prisma.user.count();
	const signUpsToday = await prisma.user.count({
		where: {
			createdAt: {
				gte: new Date(new Date().setHours(0, 0, 0, 0)),
			},
		},
	});
	const pendingReports = 0; // TODO
	const pendingAssetQueue = 0; // TODO

	const data = {
		success: true,
		code: 0,
		data: {
			userCount,
			signUpsToday,
			pendingReports,
			pendingAssetQueue,
		},
	};

	await redis.set("admin:dash", JSON.stringify(data), "EX", 60 * 5);
	return data;
}, {
	auth: true,
	admin: UserAdminTrait.ForumModerator,
});

admin.get(
	"/auditlog",
	async ({ query, set }) => {
		const page = Number(query.page) || 1;
		const perPage = Number(query.perPage) || 20;
		if (page < 1 || perPage < 1) {
			set.status = 400;
			return {
				success: false,
				error: "Bad Request",
				code: 400,
				message: "Invalid page or perPage parameters.",
			};
		}
		const logs = await prisma.auditLog.findMany({
			skip: (page - 1) * perPage,
			take: perPage,
			orderBy: { time: "desc" },
		});
		const totalLogs = await prisma.auditLog.count();
		const totalPages = Math.ceil(totalLogs / perPage);
		return {
			success: true,
			code: 0,
			logs,
			pagination: {
				page,
				perPage,
				totalLogs,
				totalPages,
			},
		};
	},
	{
		query: t.Object({
			page: t.Optional(t.Number()),
			perPage: t.Optional(t.Number()),
		}),
		auth: true,
		admin: UserAdminTrait.Administrator,
	},
);

admin.get(
	"/arbiter/list",
	async ({ set }) => {
		const nodes = await arbiter.getAllNodesFromDb();
		if (!nodes) {
			set.status = 500;
			return { arbiters: null, error: "Failed to fetch nodes" };
		}
		return {
			arbiters: nodes,
		};
	},
	{
		auth: true,
		admin: UserAdminTrait.SuperAdmin,
	},
);

admin.post(
	"/arbiter/add",
	async ({ body, set }) => {
		try {
			await prisma.arbiterNode.create({
				data: {
					name: body.nodeName,
					url: body.nodeUri,
					port: body.nodePort,
					https: body.tls,
					gameserver: body.gameserver,
					renderer: body.renderer,
				},
			});
			set.status = 201;
			return { success: true, message: "Success" };
		} catch (error) {
			set.status = 500;
			return { message: "Failed to add arbiter node" };
		}
	},
	{
		body: t.Object({
			nodeName: t.String(),
			nodeUri: t.String(),
			nodePort: t.Number(),
			tls: t.Boolean(),
			gameserver: t.Boolean(),
			renderer: t.Boolean(),
		}),
		auth: true,
		admin: UserAdminTrait.SuperAdmin,
	},
);

admin.post(
	"/arbiter/remove",
	async ({ body, set }) => {
		try {
			const node = await prisma.arbiterNode.findFirst({
				where: { id: body.nodeId },
			});
			if (!node) {
				set.status = 404;
				return { success: false, error: "Node not found." };
			}
			await prisma.arbiterNode.delete({
				where: { id: body.nodeId },
			});
			return { success: true, message: "Node removed." };
		} catch (error) {
			set.status = 500;
			return { success: false, error: "Failed to remove node." };
		}
	},
	{
		body: t.Object({
			nodeId: t.String(),
		}),
		auth: true,
		admin: UserAdminTrait.SuperAdmin,
	},
);

admin.post(
	"/totp/init",
	async ({ set, user }) => {
		if (
			user.roleSet === UserAdminTrait.Unprivileged ||
			user.roleSet === UserAdminTrait.ProtectedUser
		) {
			set.status = 403;
			return {
				success: false,
				error: "Forbidden",
				code: 403,
				message: "You do not have permission to access this resource.",
			};
		}
		if (user.totpEnrolled) {
			set.status = 400;
			return {
				success: false,
				error: "Bad Request",
				code: 400,
				message: "TOTP enrolled already.",
			};
		}
		const secret = authenticator.generateSecret();
		await prisma.user.update({
			where: { id: user.id },
			data: { totpSecret: secret },
		});
		const otpauth = authenticator.keyuri(user.username, "Simulping", secret);
		const qrCode = await qrcode.toDataURL(otpauth);
		return {
			success: true,
			code: 0,
			secret: secret,
			qr: qrCode,
		};
	},
	{
		auth: true,
	},
);

admin.get(
	"/totp/enrolled",
	async ({ user }) => {
		return {
			success: true,
			code: 0,
			enrolled: user.totpEnrolled,
		};
	},
	{
		auth: true,
	},
);

admin.post(
	"/totp/enroll",
	async ({ body, set, user, cookie: { ".simulping": auth } }) => {
		if (
			user.roleSet === UserAdminTrait.Unprivileged ||
			user.roleSet === UserAdminTrait.ProtectedUser
		) {
			set.status = 403;
			return {
				success: false,
				error: "Forbidden",
				code: 403,
				message: "You do not have permission to access this resource.",
			};
		}
		if (user.totpEnrolled) {
			set.status = 400;
			return {
				success: false,
				error: "Bad Request",
				code: 400,
				message: "TOTP already enrolled.",
			};
		}
		if (!user.totpSecret) {
			set.status = 400;
			return {
				success: false,
				error: "Bad Request",
				code: 400,
				message: "TOTP secret not found. Try refreshing the page",
			};
		}
		const isValid = authenticator.check(body.code, user.totpSecret);
		if (!isValid) {
			set.status = 400;
			return {
				success: false,
				error: "Bad Request",
				code: 400,
				message: "Invalid TOTP code.",
			};
		}
		await prisma.user.update({
			where: { id: user.id },
			data: { totpEnrolled: true },
		});
		const token = users.generateSessionToken(true);
		const session = await users.createAdminSession(token, user.id);
		if (!session) {
			set.status = 500;
			return {
				success: false,
				error: "Internal Server Error",
				code: 500,
				message: "Failed to create admin session.",
			};
		}
		auth.value = token;
		auth.httpOnly = true;
		auth.secure = true; // ensure true in prod
		auth.sameSite = "lax";
		auth.expires = new Date(Date.now() + 1000 * 60 * 60 * 6); // 6h
		return {
			success: true,
			code: 0,
			message: "TOTP enrolled successfully.",
		};
	},
	{
		body: t.Object({
			code: t.String(),
		}),
		auth: true,
	},
);

admin.post(
	"/totp/validate",
	async ({
		body,
		set,
		user,
		cookie: { ".simulping": auth, ".ROBLOSECURITY": roblo },
	}) => {
		if (auth.cookie.value) {
			const value = auth.cookie.value;
			const sessionValidation: SessionValidationResult =
				await users.validateAdminSession(
					value as string,
					roblo.cookie.value as string,
				);
			if (sessionValidation.Session && sessionValidation.User) {
				logger.debug(
					`User ${sessionValidation.User.username} is already logged in.`,
				);
				set.status = 200;
				return {
					success: true,
					token: value,
					code: 0,
					message: "OK",
				};
			}
		}
		if (
			user.roleSet === UserAdminTrait.Unprivileged ||
			user.roleSet === UserAdminTrait.ProtectedUser
		) {
			set.status = 403;
			return {
				success: false,
				error: "Forbidden",
				code: 403,
				message: "You do not have permission to access this resource.",
			};
		}
		if (!user.totpEnrolled || !user.totpSecret) {
			set.status = 400;
			return {
				success: false,
				error: "Bad Request",
				code: 400,
				message: "TOTP not enrolled.",
			};
		}

		const isValid = authenticator.check(body.code, user.totpSecret);
		if (!isValid) {
			set.status = 400;
			return {
				success: false,
				error: "Bad Request",
				code: 400,
				message: "Invalid TOTP code.",
			};
		}
		const token = users.generateSessionToken(true);
		const session = await users.createAdminSession(token, user.id);
		if (!session) {
			set.status = 500;
			return {
				success: false,
				error: "Internal Server Error",
				code: 500,
				message: "Failed to create admin session.",
			};
		}
		auth.value = token;
		auth.httpOnly = true;
		auth.secure = true; // ensure true in prod
		auth.sameSite = "lax";
		auth.expires = new Date(Date.now() + 1000 * 60 * 60 * 6); // 6h
		set.status = 200;
		return {
			success: true,
			code: 0,
			message: "OK",
			token: token,
		};
	},
	{
		auth: true,
		body: t.Object({
			code: t.String(),
		}),
	},
);

admin.get(
	"/features/list",
	async () => {
		return {
			success: true,
			features: await featUtil.admin.getAllWithMetadata(),
		};
	},
	{
		auth: true,
		admin: UserAdminTrait.SuperAdmin,
	},
);

admin.post(
	"/features/:key",
	async ({ params, body, set }) => {
		const { key } = params;
		const { enabled } = body;

		if (!featUtil.admin.isValid(key)) {
			set.status = 418;
			return {
				success: false,
				message: "Bread tastes better than key"
			};
		}
		await featUtil.admin.set(key, enabled);

		set.status = 200;
		return {
			success: true,
		};
	},
	{
		auth: true,
		admin: UserAdminTrait.SuperAdmin,
		body: t.Object({
			enabled: t.Boolean(),
		}),
	},
);

admin.post(
	"/games",
	async ({ user }) => {
		return assets.createGame(
			"Baseplate",
			"New Place",
			user.id,
			CreatorType.User,
		);
	},
	{
		auth: true,
		admin: UserAdminTrait.Administrator,
	},
);

admin.post(
	"/forum",
	async ({ user, body, set }) => {
		try {
			const forum = await prisma.forum.create({
				data: {
					name: body.name,
					description: body.description,
					createdBy: user.id,
					category: body.category,
				},
			});
			await prisma.auditLog.create({
				data: {
					userId: user.id,
					action: "CREATE_FORUM",
					details: `Forum ID: ${forum.id}, Name: ${forum.name}, Category: ${forum.category}`,
				},
			});
			return {
				success: true,
				forumId: forum.id,
				error: null,
				code: 0,
				message: "Forum created successfully.",
			};
		} catch (error) {
			set.status = 500;
			logger.error(`AdminError: Failed to create forum: ${error}`);
			return {
				success: false,
				forumId: null,
				error: "Internal Server Error",
				code: 500,
				message: "An error occurred while creating the forum.",
			};
		}
	},
	{
		body: t.Object({
			name: t.String(),
			description: t.String(),
			category: t.Union([
				t.Literal(ForumCategory.Roblox),
				t.Literal(ForumCategory.ClubHouses),
				t.Literal(ForumCategory.GameCreationAndDevelopment),
				t.Literal(ForumCategory.Entertainment),
			]),
		}),
		auth: true,
		admin: UserAdminTrait.Administrator,
	},
);

admin.post(
	"/forum/lock",
	async ({ body, set, user }) => {
		try {
			const forum = await prisma.forum.findUnique({
				where: { id: body.forumId },
				select: { locked: true },
			});
			if (!forum) {
				set.status = 404;
				return {
					success: false,
					forumId: null,
					error: "Forum not found",
					code: 404,
					message: "Forum not found.",
				};
			}
			const updated = await prisma.forum.update({
				where: { id: body.forumId },
				data: { locked: !forum.locked },
			});
			await prisma.auditLog.create({
				data: {
					userId: user.id,
					action: "TOGGLE_FORUM_LOCK",
					details: `Forum ID: ${body.forumId}, New Lock Status: ${!forum.locked}`,
				},
			});
			return {
				success: true,
				forumId: updated.id,
				locked: updated.locked,
				error: null,
				code: 0,
				message: `Forum lock toggled to ${updated.locked}.`,
			};
		} catch (error) {
			set.status = 500;
			logger.error(`AdminError: Failed to toggle forum lock: ${error}`);
			return {
				success: false,
				forumId: null,
				error: "Internal Server Error",
				code: 500,
				message: "An error occurred while toggling the forum lock.",
			};
		}
	},
	{
		body: t.Object({
			forumId: t.Number(),
		}),
		auth: true,
		admin: UserAdminTrait.Administrator,
	},
);

admin.get(
	"/forum/thread",
	async ({ query, set }) => {
		const thread = await prisma.forumThread.findUnique({
			where: { id: query.threadId },
			include: {
				forum: {
					select: { id: true, name: true },
				},
				createdByUser: {
					select: { id: true, username: true },
				},
			},
		});

		if (!thread) {
			set.status = 404;
			return {
				success: false,
				message: "Thread not found",
				thread: null,
			};
		}

		return {
			success: true,
			data: {
				id: thread.id,
				hidden: thread.hidden,
				content: thread.content,
				createdAt: thread.createdAt,
				forum: {
					id: thread.forum.id,
					name: thread.forum.name,
				},
				user: {
					id: thread.createdByUser.id,
					username: thread.createdByUser.username,
				},
			},
		};
	},
	{
		auth: true,
		admin: UserAdminTrait.ForumModerator,
		query: t.Object({
			threadId: t.Number(),
		}),
	},
);

admin.get(
	"/forum/post",
	async ({ query, set }) => {
		const post = await prisma.forumPost.findUnique({
			where: { id: query.postId },
			include: {
				forum: {
					select: { id: true, name: true },
				},
				createdByUser: {
					select: { id: true, username: true },
				},
			},
		});

		if (!post) {
			set.status = 404;
			return {
				success: false,
				message: "Post not found",
				post: null,
			};
		}

		return {
			success: true,
			data: {
				id: post.id,
				content: post.content,
				createdAt: post.createdAt,
				hidden: post.hidden,
				forum: {
					id: post.forum.id,
					name: post.forum.name,
				},
				user: {
					id: post.createdByUser.id,
					username: post.createdByUser.username,
				},
			},
		};
	},
	{
		auth: true,
		admin: UserAdminTrait.ForumModerator,
		query: t.Object({
			postId: t.Number(),
		}),
	},
);

admin.delete(
	"/forum/thread",
	async ({ body, set, user }) => {
		try {
			const thread = await prisma.forumThread.findUnique({
				where: { id: body.threadId },
				select: { hidden: true },
			});
			if (!thread) {
				set.status = 404;
				return {
					success: false,
					threadId: null,
					error: "Thread not found",
					code: 404,
					message: "Thread not found.",
				};
			}
			const updated = await prisma.forumThread.update({
				where: { id: body.threadId },
				data: { hidden: !thread.hidden },
			});
			await prisma.auditLog.create({
				data: {
					userId: user.id,
					action: "TOGGLE_THREAD_VISIBILITY",
					details: `Thread ID: ${body.threadId}, New Visibility: ${!thread.hidden}`,
				},
			});
			return {
				success: true,
				threadId: updated.id,
				hidden: updated.hidden,
				error: null,
				code: 0,
				message: `Thread visibility toggled to ${updated.hidden ? "hidden" : "visible"}.`,
			};
		} catch (error) {
			set.status = 500;
			logger.error(`AdminError: Failed to toggle thread visibility: ${error}`);
			return {
				success: false,
				threadId: null,
				error: "Internal Server Error",
				code: 500,
				message: "An error occurred while toggling the thread visibility.",
			};
		}
	},
	{
		body: t.Object({
			threadId: t.Number(),
		}),
		auth: true,
		admin: UserAdminTrait.ForumModerator,
	},
);

admin.delete(
	"/forum/post",
	async ({ body, set, user }) => {
		try {
			const post = await prisma.forumPost.findUnique({
				where: { id: body.postId },
				select: { hidden: true },
			});
			if (!post) {
				set.status = 404;
				return {
					success: false,
					postId: null,
					error: "Post not found",
					code: 404,
					message: "Post not found.",
				};
			}
			const updated = await prisma.forumPost.update({
				where: { id: body.postId },
				data: { hidden: !post.hidden },
			});
			await prisma.auditLog.create({
				data: {
					userId: user.id,
					action: "TOGGLE_POST_VISIBILITY",
					details: `Post ID: ${body.postId}, New Visibility: ${!post.hidden}`,
				},
			});
			return {
				success: true,
				postId: updated.id,
				hidden: updated.hidden,
				error: null,
				code: 0,
				message: `Post visibility toggled to ${updated.hidden ? "hidden" : "visible"}.`,
			};
		} catch (error) {
			set.status = 500;
			logger.error(`AdminError: Failed to toggle post visibility: ${error}`);
			return {
				success: false,
				postId: null,
				error: "Internal Server Error",
				code: 500,
				message: "An error occurred while toggling the post visibility.",
			};
		}
	},
	{
		body: t.Object({
			postId: t.Number(),
		}),
		auth: true,
		admin: UserAdminTrait.ForumModerator,
	},
);


admin.get("/users/:id", async ({ params, set }) => {
	const searchedUser = await prisma.user.findUnique({
		where: { id: params.id },
		select: {
			id: true,
			username: true,
			roleSet: true,
			createdAt: true,
			membership: true,
			robux: true,
			tickets: true,
			lastLogin: true,
			about: true,
			accountStatus: true,
			totpEnrolled: true,
			latestModeration: {
				select: {
					action: true,
					cannotReactivateUntil: true,
					date: true,
					resolved: true,
				}
			},
			moderation: true,
			modNotes: {
				select: {
					id: true,
					note: true,
					createdAt: true,
					moderator: {
						select: {
							id: true,
							username: true,
						}
					}
				}
			}
		},
	});

	if (!searchedUser) {
		set.status = 404;
		return {
			success: false,
			error: "User not found",
			data: null,
		};
	}

	const serialized = Object.fromEntries(
		Object.entries(searchedUser).map(([k, v]) => [
			k,
			typeof v === "bigint" ? v.toString() : v,
		])
	);

	return {
		success: true,
		error: null,
		data: serialized,
	};
}, {
	auth: true,
	admin: UserAdminTrait.Moderator,
	params: t.Object({
		id: t.Number(),
	}),
});


admin.get("/users/:id/ips", async ({ params, set }) => {
	const userId = Number(params.id);
	if (isNaN(userId)) {
		set.status = 400;
		return {
			success: false,
			error: "Invalid User ID",
			ips: null,
		};
	}
	const user = await prisma.user.findFirst({
		where: { id: userId },
		select: {
			ips: {
				select: {
					content: true,
					banned: true,
					lastSeen: true,
					_count: true,
				}
			}
		},
	});
	if (!user) {
		set.status = 400;
		return {
			success: false,
			error: "User not found",
			ips: null,
		};
	}
	for (const ip of user.ips || []) {
		ip.content = await ipUtil.encryption.decryptIP(ip.content);
	}
	return {
		success: true,
		error: null,
		ips: user.ips || [],
	};
}, {
	auth: true,
	admin: UserAdminTrait.Moderator,
	params: t.Object({
		id: t.Number(),
	}),
});

admin.delete("/users/:id/notes/:noteId", async ({ params, set, user }) => {
	const userId = Number(params.id);
	const noteId = Number(params.noteId);
	if (isNaN(userId)) {
		set.status = 400;
		return {
			success: false,
			error: "Invalid user ID",
			message: null,
		};
	}
	if (isNaN(noteId)) {
		set.status = 400;
		return {
			success: false,
			error: "Invalid note ID",
			message: null,
		};
	}

	const res = await prisma.moderationNotes.findFirst({
		where: {
			id: noteId,
			userId: userId,
		},
	});

	if (!res) {
		set.status = 404;
		return {
			success: false,
			error: "Note not found",
			message: null,
		};
	}

	await prisma.moderationNotes.delete({
		where: {
			id: noteId,
		},
	});

	return {
		success: true,
		error: null,
		message: "Success",
	};
}, {
	auth: true,
	admin: UserAdminTrait.Moderator,
	params: t.Object({
		id: t.Number(),
		noteId: t.Number(),
	}),
});

admin.put("/users/:id/notes", async ({ params, body, set, user }) => {
	const searchedUser = await prisma.user.findUnique({
		where: { id: params.id },
		select: { id: true },
	});

	if (!searchedUser) {
		set.status = 404;
		return {
			success: false,
			error: "User not found",
			data: null,
		};
	}

	const newNote = await prisma.moderationNotes.create({
		data: {
			userId: searchedUser.id,
			moderatorId: user.id,
			note: body.note,
		},
		select: {
			id: true,
			note: true,
			createdAt: true,
			moderator: {
				select: {
					id: true,
					username: true,
				}
			}
		}
	});

	return {
		success: true,
		error: null,
		data: newNote,
	};
}, {
	auth: true,
	admin: UserAdminTrait.Moderator,
	params: t.Object({
		id: t.Number(),
	}),
	body: t.Object({
		note: t.String(),
	}),
});

admin.post("/users", async ({ body, set }) => {
	const { page, limit } = body;
	const pageNum = page ? Number(page) : 1;
	const limitNum = limit ? Number(limit) : 10;
	const skip = (pageNum - 1) * limitNum;

	const [usersRaw, total] = await prisma.$transaction([
		prisma.user.findMany({
			select: {
				id: true,
				username: true,
				roleSet: true,
				createdAt: true,
				lastLogin: true,
				accountStatus: true,
				latestModeration: {
					select: {
						resolved: true,
						cannotReactivateUntil: true,
						action: true,
					},
				},
			},
			orderBy: { id: "asc" },
			skip,
			take: limitNum,
		}),
		prisma.user.count(),
	]);

	const users = usersRaw.map((u) => ({
		id: u.id,
		username: u.username,
		roleSet: u.roleSet,
		createdAt: u.createdAt,
		lastLogin: u.lastLogin,
		status: u.accountStatus,
		approved: getApprovedStatus(u),
	}));

	return {
		success: true,
		error: null,
		data: users,
		pagination: {
			page: pageNum,
			limit: limitNum,
			total,
			totalPages: Math.ceil(total / limitNum),
		}
	};
}, {
	body: t.Object({
		page: t.Optional(t.Union([t.String(), t.Number()])),
		limit: t.Optional(t.Union([t.String(), t.Number()])),
	}),
	auth: true,
	admin: UserAdminTrait.Moderator
});

admin.post("/users/by-username", async ({ body }) => {
	const { username, page, limit } = body;
	const pageNum = page ? Number(page) : 1;
	const limitNum = limit ? Number(limit) : 10;
	const skip = (pageNum - 1) * limitNum;

	const [usersRaw, total] = await prisma.$transaction([
		prisma.user.findMany({
			where: { username: { contains: username, mode: "insensitive" } },
			select: {
				id: true,
				username: true,
				roleSet: true,
				createdAt: true,
				lastLogin: true,
				accountStatus: true,
				latestModeration: {
					select: {
						resolved: true,
						cannotReactivateUntil: true,
						action: true,
					},
				},
			},
			orderBy: { id: "asc" },
			skip,
			take: limitNum,
		}),
		prisma.user.count({
			where: { username: { contains: username, mode: "insensitive" } },
		}),
	]);

	const users = usersRaw.map((u) => ({
		id: u.id,
		username: u.username,
		roleSet: u.roleSet,
		createdAt: u.createdAt,
		lastLogin: u.lastLogin,
		status: u.accountStatus,
		approved: getApprovedStatus(u),
	}));

	return {
		success: true,
		error: null,
		data: users,
		pagination: {
			page: pageNum,
			limit: limitNum,
			total,
			totalPages: Math.ceil(total / limitNum),
		},
	};
}, {
	body: t.Object({
		username: t.String(),
		page: t.Optional(t.Union([t.String(), t.Number()])),
		limit: t.Optional(t.Union([t.String(), t.Number()])),
	}),
	auth: true,
	admin: UserAdminTrait.Moderator
});

admin.post("/users/by-id", async ({ body, set }) => {
	const { userId } = body;
	const userIdNum = Number(userId);
	if (isNaN(userIdNum)) {
		set.status = 400;
		return {
			success: false,
			error: "Invalid userId parameter",
			data: null,
		};
	}
	const user = await prisma.user.findUnique({
		where: { id: userIdNum },
		select: {
			id: true,
			username: true,
			roleSet: true,
			createdAt: true,
			lastLogin: true,
			accountStatus: true,
			latestModeration: {
				select: {
					resolved: true,
					cannotReactivateUntil: true,
					action: true,
				},
			},
		},
	});
	if (!user) {
		set.status = 404;
		return {
			success: true,
			error: null,
			data: [],
		};
	}
	return {
		success: true,
		error: null,
		data: [{
			id: user.id,
			username: user.username,
			roleSet: user.roleSet,
			createdAt: user.createdAt,
			lastLogin: user.lastLogin,
			status: user.accountStatus,
			approved: getApprovedStatus(user),
		}],
	};
}, {
	auth: true,
	admin: UserAdminTrait.Moderator,
	body: t.Object({
		userId: t.String(),
	}),
});

admin.post("/users/by-ip-address", async ({ body, set }) => {
	const { ip, page, limit } = body;
	const pageNum = page ? Number(page) : 1;
	const limitNum = limit ? Number(limit) : 10;
	const skip = (pageNum - 1) * limitNum;

	const hash = ipUtil.encryption.hashIP(ip);
	const foundIp = await prisma.ip.findUnique({
		where: {
			contentHash: hash,
		},
		select: {
			users: {
				select: {
					id: true,
					username: true,
					roleSet: true,
					createdAt: true,
					lastLogin: true,
					accountStatus: true,
					latestModeration: {
						select: {
							resolved: true,
							cannotReactivateUntil: true,
							action: true,
						},
					},
				},
				orderBy: { id: "asc" },
				skip,
				take: limitNum,
			},
			_count: {
				select: { users: true },
			},
		}
	})
	if (!foundIp) {
		set.status = 404;
		return {
			success: false,
			error: null,
			data: [],
		}
	}

	const total = foundIp._count.users;

	const users = foundIp.users.map((u) => ({
		id: u.id,
		username: u.username,
		roleSet: u.roleSet,
		createdAt: u.createdAt,
		lastLogin: u.lastLogin,
		status: u.accountStatus,
		approved: getApprovedStatus(u),
	}));

	return {
		success: true,
		error: null,
		data: users,
		pagination: {
			page: pageNum,
			limit: limitNum,
			total,
			totalPages: Math.ceil(total / limitNum),
		},
	}
}, {
	body: t.Object({
		ip: t.String(),
		page: t.Optional(t.Union([t.String(), t.Number()])),
		limit: t.Optional(t.Union([t.String(), t.Number()])),
	}),
	auth: true,
	admin: UserAdminTrait.Moderator
})

admin.post("/users/by-pii-id", async ({ body, set }) => {
	const { piiId, page, limit } = body;
	const pageNum = page ? Number(page) : 1;
	const limitNum = limit ? Number(limit) : 10;
	const skip = (pageNum - 1) * limitNum;

	const [fingerprintResult, total] = await prisma.$transaction([
		prisma.fingerprint.findFirst({
			where: { fingerprint: piiId },
			select: {
				users: {
					select: {
						id: true,
						username: true,
						roleSet: true,
						createdAt: true,
						lastLogin: true,
						accountStatus: true,
						latestModeration: {
							select: {
								resolved: true,
								cannotReactivateUntil: true,
								action: true,
							},
						},
					},
					orderBy: { id: "asc" },
					skip,
					take: limitNum,
				},
			},
		}),
		prisma.fingerprint.count({
			// count 'users' related to this piiId
			where: { fingerprint: piiId },
		}),
	]);

	const usersRaw = fingerprintResult ? fingerprintResult.users : [];
	const users = usersRaw.map((u) => ({
		id: u.id,
		username: u.username,
		roleSet: u.roleSet,
		createdAt: u.createdAt,
		lastLogin: u.lastLogin,
		status: u.accountStatus,
		approved: getApprovedStatus(u),
	}));

	return {
		success: true,
		error: null,
		data: users,
		pagination: {
			page: pageNum,
			limit: limitNum,
			total,
			totalPages: Math.ceil(total / limitNum),
		},
	};
}, {
	body: t.Object({
		piiId: t.String(),
		page: t.Optional(t.Union([t.String(), t.Number()])),
		limit: t.Optional(t.Union([t.String(), t.Number()])),
	}),
	auth: true,
	admin: UserAdminTrait.Moderator
});

admin.post(
	"/users/:id/escalate",
	async ({ params, body, set, user }) => {
		const targetUser = await prisma.user.findUnique({
			where: { id: params.id },
		});
		if (!targetUser) {
			set.status = 404;
			return {
				success: false,
				error: "User not found",
				id: null
			};
		}
		if (user.id === targetUser.id) {
			set.status = 400;
			return {
				success: false,
				error: "You cannot modify escalations on yourself",
				id: null
			};
		}
		if (users.hasHigherTrait(targetUser.roleSet, UserAdminTrait.ProtectedUser)) {
			set.status = 401;
			return {
				success: false,
				error: "This is a protected user",
				id: null
			};
		}
		if (await redis.get(`user:${targetUser.id}:banned`)) {
			await redis.del(`user:${targetUser.id}:banned`);
		}
		const duration = calculateDuration(body.override);
		const status = calculateModerationStatus(body.override);
		const moderationEntry = await prisma.moderation.create({
			data: {
				reason: body.reason,
				internalNotes: body.internalNotes,
				action: body.override,
				resolved: false,
				cannotReactivateUntil: duration,
				user: { connect: { id: targetUser.id } },
			},
		});
		await prisma.user.update({
			where: { id: targetUser.id },
			data: { accountStatus: status, latestModerationId: moderationEntry.id },
		});
		return {
			success: true,
			error: null,
			id: moderationEntry.id
		};
	},
	{
		auth: true,
		admin: UserAdminTrait.Moderator,
		params: t.Object({
			id: t.Number(),
		}),
		body: t.Object({
			override: t.Enum(Escalation),
			reason: t.String(),
			internalNotes: t.String(),
		}),
	},
);

if (config.webserver.isTestWebsite) {
	admin.put(
		"/testwebsite/create-invite-batch",
		async ({ body, set }) => {
			const invitesData = [];

			for (let i = 0; i < body.count; i++) {
				const invite = await users.createInviteCode();
				if (invite) {
					invitesData.push({
						code: invite.code,
						link: `${config.webserver.baseUrl}/?${new URLSearchParams({ i: invite.code }).toString()}`,
						used: invite.used,
						usedBy: invite.usedBy,
						createdAt: invite.createdAt
					});
				}
			}

			set.status = 200;
			return {
				success: true,
				invites: invitesData,
				links: invitesData.map(i => i.link)
			};
		}, {
		body: t.Object({
			count: t.Number({
				min: 1,
				max: 20,
			}),
		}),
		rateLimit: {
			maxRequests: 20,
			limitSeconds: 60,
		},
		auth: true,
		admin: UserAdminTrait.Administrator,
	});

	admin.get(
		"/testwebsite/invites/:code",
		async ({ set, params }) => {
			const inv = await prisma.invite.findUnique({
				where: { code: params.code },
			});
			if (!inv) {
				set.status = 404;
				return {
					success: false,
					error: "Invite not found",
					invite: null,
				};
			}
			return {
				success: true,
				error: null,
				invite: inv,
				link: `${config.webserver.baseUrl}/?${new URLSearchParams({ i: inv.code }).toString()}`,
			};
		}, {
		auth: true,
		admin: UserAdminTrait.Administrator,
		params: t.Object({
			code: t.String(),
		}),
	}
	)
}

admin.post(
	"/import-asset", async ({ body, user, set }) => {
		// TODO
		set.status = 503;
		return "This is todo";
		const assetExists = await prisma.asset.findFirst({
			where: { id: body.assetId },
		});
		if (assetExists) {
			set.status = 400;
			return { success: false, error: "Asset already exists" };
		}
		try {
			const hash = await assets.migrateRobloxAsset(body.assetId, false, allowedCatalogMigrationTypes);
			if (!hash) {
				set.status = 500;
				return { success: false, error: "Failed to import asset" };
			}
			return hash;
			// TODO: make it add a Product
		} catch (error: Error | any) {
			logger.error(`AdminError: Failed to import asset ${body.assetId}: ${error}`);
			set.status = 500;
			return { success: false, error: `${error.message || "Unknown error"}` };
		}
	}, {
	body: t.Object({
		assetId: t.Number(),
	}),
	auth: true,
	admin: UserAdminTrait.AssetManager,
});

export default admin;