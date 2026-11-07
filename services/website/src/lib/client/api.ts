type RequestMethod = "GET" | "POST" | "PUT" | "DELETE";

interface APIResponse<T = any> {
	data?: T;
	error?: { value: any };
}

type QueryParams = Record<string, string | number | boolean | undefined | null>;

function buildUrl(path: string, query?: QueryParams): string {
	if (!query) return path;
	const qs = new URLSearchParams();
	for (const [key, value] of Object.entries(query)) {
		if (value === undefined || value === null || value === "") continue;
		qs.append(key, String(value));
	}
	return `${path}?${qs.toString()}`;
}

function interpolatePath(
	path: string,
	params?: Record<string, string | number>,
): string {
	if (!params) return path;
	return path.replace(/:([a-zA-Z_]+)/g, (_, key) => {
		if (!(key in params)) {
			throw new Error(`Missing route param: ${key}`);
		}
		return encodeURIComponent(String(params[key]));
	});
}

async function makeRequest<T = any>(
	fetchFn: typeof fetch,
	method: RequestMethod,
	path: string,
	body?: any,
	query?: QueryParams,
): Promise<APIResponse<T>> {
	return fetchFn(buildUrl(path, query), {
		method,
		headers: {
			"Content-Type": "application/json",
		},
		...(body ? { body: JSON.stringify(body) } : {}),
	})
		.then(async (res) => {
			const json = await res.json();
			if (!res.ok) {
				return { error: { value: json } };
			}
			return { data: json };
		})
		.catch((err) => ({ error: { value: err } }));
}

function defineRoute(path: string) {
	return {
		get: <T = any>(
			fetchFn: typeof fetch,
			{
				query,
				params,
			}: { query?: QueryParams; params?: Record<string, string | number> } = {},
		) =>
			makeRequest<T>(
				fetchFn,
				"GET",
				interpolatePath(path, params),
				undefined,
				query,
			),

		post: <T = any>(
			fetchFn: typeof fetch,
			{
				body,
				query,
				params,
			}: {
				body?: any;
				query?: QueryParams;
				params?: Record<string, string | number>;
			} = {},
		) =>
			makeRequest<T>(
				fetchFn,
				"POST",
				interpolatePath(path, params),
				body,
				query,
			),

		put: <T = any>(
			fetchFn: typeof fetch,
			{
				body,
				query,
				params,
			}: {
				body?: any;
				query?: QueryParams;
				params?: Record<string, string | number>;
			} = {},
		) =>
			makeRequest<T>(
				fetchFn,
				"PUT",
				interpolatePath(path, params),
				body,
				query,
			),

		delete: <T = any>(
			fetchFn: typeof fetch,
			{
				body,
				query,
				params,
			}: {
				body?: any;
				query?: QueryParams;
				params?: Record<string, string | number>;
			} = {},
		) =>
			makeRequest<T>(
				fetchFn,
				"DELETE",
				interpolatePath(path, params),
				body,
				query,
			),
	};
}

const api = {
	register: defineRoute("/api/users/create"),
	login: defineRoute("/api/users/login"),
	features: defineRoute("/api/users/featureflags"),
	whyAmIBanned: defineRoute("/api/users/my/banned"),
	reactivate: defineRoute("/api/users/my/reactivate"),
	logout: defineRoute("/api/users/log-out"),
	takenUsername: defineRoute("/api/users/is-taken"),
	validateInviteCode: defineRoute("/api/users/validate-invite"),
	profile: defineRoute("/api/users/:id"),
	games: {
		sort: defineRoute("/api/games/sort"),
		single: defineRoute("/api/games/get"),
	},
	forums: {
		categories: defineRoute("/api/forums"),
		threads: defineRoute("/api/forums/:id"),
		newThread: defineRoute("/api/forums/:id/new-thread"),
		newPost: defineRoute("/api/forums/thread/:id/new-post"),
		thread: defineRoute("/api/forums/thread/:id"),
		markAsRead: defineRoute("/api/forums/thread/:id/mark-as-read"),
	},
	admin: {
		dashBoardData: defineRoute("/api/admin/dash"),
		totp: {
			init: defineRoute("/api/admin/totp/init"),
			enroll: defineRoute("/api/admin/totp/enroll"),
			validate: defineRoute("/api/admin/totp/validate"),
		},
		arbiter: {
			listNodes: defineRoute("/api/admin/arbiter/list"),
			create: defineRoute("/api/admin/arbiter/add"),
		},
		flags: {
			update: defineRoute("/api/admin/features/:key"),
			list: defineRoute("/api/admin/features/list"),
		},
		forum: {
			getPost: defineRoute("/api/admin/forum/post"),
			getThread: defineRoute("/api/admin/forum/thread"),
		},
		users: {
			getUser: defineRoute("/api/admin/users/:id"),
			getUserIps: defineRoute("/api/admin/users/:id/ips"),
			notes: {
				create: defineRoute("/api/admin/users/:id/notes"),
				delete: defineRoute("/api/admin/users/:id/notes/:noteId"),
			},
			escalate: defineRoute("/api/admin/users/:id/escalate"),
			list: defineRoute("/api/admin/users"),
			byUsername: defineRoute("/api/admin/users/by-username"),
			byId: defineRoute("/api/admin/users/by-id"),
			byIp: defineRoute("/api/admin/users/by-ip-address"),
			byPiiId: defineRoute("/api/admin/users/by-pii-id"),
			invites: {
				createBatch: defineRoute("/api/admin/testwebsite/create-invite-batch"),
				getInfo: defineRoute("/api/admin/testwebsite/invites/:code"),
			}
		},
		economy: {
			importasset: defineRoute("/api/admin/import-asset"),
		}
	},
	develop: {
		create: defineRoute("/api/develop/create"),
		createPlace: defineRoute("/api/develop/create-place"),
		listPlaces: defineRoute("/api/places/get-all"),
		listGames: defineRoute("/api/universes/get-all"),
	},
};

export { api };
