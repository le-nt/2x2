import { Elysia, t } from "elysia";
import { Prisma } from "@prisma/client";
import { UserAdminTrait } from "@prisma/client";
import auth from "@/macros/auth";
import prisma from "@/prisma";
import logger from "@/util/logger";
import { hasHigherTrait } from "@client/traits";

const forumsApi = new Elysia({ prefix: "/forums" })
    .use(auth.as("scoped"));

forumsApi.get(
    "/",
    async ({ set }) => {
        try {
            const forums = await prisma.forum.findMany({
                select: {
                    id: true,
                    name: true,
                    description: true,
                    category: true,
                    locked: true,
                    _count: {
                        select: {
                            threads: true,
                            posts: true,
                        },
                    },
                    threads: {
                        select: {
                            createdAt: true,
                            createdByUser: {
                                select: { id: true, username: true }
                            }
                        },
                        orderBy: {
                            createdAt: 'desc',
                        },
                        take: 1,
                    },
                    posts: {
                        select: {
                            createdAt: true,
                            createdByUser: {
                                select: { id: true, username: true }
                            }
                        },
                        orderBy: {
                            createdAt: 'desc',
                        },
                        take: 1,
                    },
                },
                orderBy: {
                    name: "asc",
                },
            });

            const forumsWithDetails = forums.map(forum => {
                const newestThread = forum.threads[0] ?? null;
                const newestPost = forum.posts[0] ?? null;

                let newestActivity = null;
                if (newestThread && newestPost) {
                    newestActivity = newestThread.createdAt > newestPost.createdAt
                        ? newestThread
                        : newestPost;
                } else if (newestThread) {
                    newestActivity = newestThread;
                } else if (newestPost) {
                    newestActivity = newestPost;
                }

                return {
                    id: forum.id,
                    name: forum.name,
                    description: forum.description,
                    category: forum.category,
                    locked: forum.locked,
                    threadsCount: forum._count.threads,
                    postsCount: forum._count.posts,
                    newestActivity
                };
            });

            return {
                success: true,
                forums: forumsWithDetails,
            };
        } catch (error) {
            set.status = 500;
            logger.error(`ForumAPIError: Failed to retrieve forums: ${error}`);
            return {
                success: false,
                error: "Internal Server Error",
            };
        }
    },
    {
        auth: true,
    }
);

forumsApi.get(
    "/:id",
    async ({ params, query, set, user }) => {
        const page = query.page && query.page > 0 ? query.page : 1;
        const perPage = query.perPage && query.perPage > 0 ? query.perPage : 15;

        try {
            const forum = await prisma.forum.findUnique({
                where: { id: params.id },
                select: {
                    id: true,
                    name: true,
                    description: true,
                    locked: true,
                    category: true,
                }
            });

            if (!forum) {
                set.status = 404;
                return { success: false, error: "Forum not found" };
            }

            const canViewHidden = hasHigherTrait(
                user.roleSet,
                UserAdminTrait.ForumModerator
            );
            const [threads, totalThreads] = await Promise.all([
                prisma.forumThread.findMany({
                    where: {
                        forumId: params.id,
                        hidden: canViewHidden ? undefined : false
                    },
                    select: {
                        id: true,
                        title: true,
                        createdAt: true,
                        hidden: true,
                        createdByUser: {
                            select: { username: true }
                        },
                        posts: {
                            where: { hidden: false },
                            orderBy: { createdAt: 'desc' },
                            take: 1,
                            select: {
                                id: true,
                                createdAt: true,
                                createdByUser: {
                                    select: { username: true }
                                }
                            }
                        },
                        _count: {
                            select: {
                                posts: { where: { hidden: false } },
                                views: true
                            },
                        }
                    },
                    orderBy: { createdAt: 'desc' },
                    skip: (page - 1) * perPage,
                    take: perPage,
                }),
                prisma.forumThread.count({
                    where: {
                        forumId: params.id,
                        hidden: canViewHidden ? undefined : false
                    },
                })
            ]);

            // * Get threads user has viewed
            const views = await prisma.threadView.findMany({
                where: {
                    userId: user.id,
                    threadId: { in: threads.map((t) => t.id) },
                },
                select: { threadId: true },
            });
            const viewedMap = Object.fromEntries(views.map((v) => [v.threadId, true]));

            // * Format the threads
            const formattedThreads = threads.map(thread => ({
                id: thread.id,
                title: thread.title,
                createdAt: thread.createdAt,
                hidden: thread.hidden,
                author: thread.createdByUser.username,
                postCount: thread._count.posts,
                views: thread._count.views,
                hasViewed: !!viewedMap[thread.id],
                lastPost: thread.posts[0]
                    ? {
                        createdAt: thread.posts[0].createdAt,
                        author: thread.posts[0].createdByUser.username
                    }
                    : null
            }));

            return {
                success: true,
                forum,
                threads: formattedThreads,
                pagination: {
                    page,
                    perPage,
                    totalThreads,
                    totalPages: Math.ceil(totalThreads / perPage),
                },
            };
        } catch (error) {
            set.status = 500;
            logger.error(`ForumAPIError: Failed to retrieve forum: ${error}`);
            return { success: false, error: "Internal Server Error" };
        }
    },
    {
        params: t.Object({ id: t.Number() }),
        query: t.Object({
            page: t.Optional(t.Numeric()),
            perPage: t.Optional(t.Numeric()),
        }),
        auth: true
    }
);

forumsApi.post(
    "/thread/:id/mark-as-read",
    async ({ params, set, user }) => { 
        try {
            await prisma.threadView.upsert({
                where: {
                    threadId_userId: {
                        userId: user.id,
                        threadId: Number(params.id)
                    }
                },
                update: {},
                create: {
                    userId: user.id,
                    threadId: Number(params.id)
                },
            })
        } catch(error) {
            if (
                error instanceof Prisma.PrismaClientKnownRequestError &&
                error.code === "P2003"
            ) {
                set.status = 400;
            } else {
                throw error;
            }
        }
    },
    {
        params: t.Object({ id: t.Integer() }),
        auth: true
    }
)

forumsApi.get(
    "/thread/:id",
    async ({ params, query, set, user }) => {
        const page = query.page && query.page > 0 ? Number(query.page) : 1;
        const perPage = query.perPage && query.perPage > 0 ? Number(query.perPage) : 10;

        try {
            const canViewHidden = hasHigherTrait(
                user.roleSet,
                UserAdminTrait.ForumModerator
            );
            const thread = await prisma.forumThread.findUnique({
                where: {
                    id: params.id,
                    hidden: canViewHidden ? undefined : false
                },
                select: {
                    id: true,
                    title: true,
                    content: true,
                    hidden: true,
                    createdAt: true,
                    forum: { select: { id: true, name: true, locked: true, category: true } },
                    createdByUser: {
                        select: {
                            id: true,
                            username: true,
                            createdAt: true,
                            roleSet: true,
                            _count: {
                                select: {
                                    forumPosts: true,
                                    forumThreads: true
                                }
                            }
                        }
                    },
                }
            });

            if (!thread) {
                set.status = 404;
                return { success: false, error: "Thread not found" };
            }

            const [posts, totalPosts] = await Promise.all([
                prisma.forumPost.findMany({
                    where: { threadId: params.id },
                    select: {
                        id: true,
                        content: true,
                        createdAt: true,
                        hidden: true,
                        createdByUser: {
                            select: {
                                id: true,
                                username: true,
                                createdAt: true,
                                roleSet: true,
                                _count: {
                                    select: {
                                        forumPosts: true,
                                        forumThreads: true
                                    }
                                }
                            }
                        },
                    },
                    orderBy: { createdAt: query.sortOrder },
                    skip: (page - 1) * perPage,
                    take: perPage,
                }),
                prisma.forumPost.count({
                    where: { threadId: params.id  }
                })
            ]);

            const formattedPosts = posts.map(post => {
                const canView = (!post.hidden || hasHigherTrait(user.roleSet, UserAdminTrait.ForumModerator));
                return {
                    postId: post.id,
                    content: canView ? post.content : "[ Content Deleted ]",
                    createdAt: post.createdAt,
                    author: post.createdByUser
                };
            });

            return {
                success: true,
                thread: {
                    id: thread.id,
                    title: thread.title,
                    content: thread.content,
                    createdAt: thread.createdAt,
                    hidden: thread.hidden,
                    author: thread.createdByUser
                },
                forum: thread.forum,
                posts: formattedPosts,
                pagination: {
                    page,
                    perPage,
                    totalPosts,
                    totalPages: Math.ceil(totalPosts / perPage),
                },
            };

        } catch (error) {
            set.status = 500;
            logger.error(`ForumAPIError: Failed to retrieve thread: ${error}`);
            return { success: false, error: "Internal Server Error" };
        }
    },
    {
        params: t.Object({ id: t.Integer() }),
        query: t.Object({
            page: t.Optional(t.Numeric()),
            perPage: t.Optional(t.Numeric()),
            sortOrder: t.Union([
                t.Literal("asc"),
                t.Literal("desc"),
            ], { default: "asc" }),
        }),
        auth: true
    }
);

forumsApi.post(
    "/:id/new-thread",
    async ({ user, params, body, set }) => {
        try {
            const forum = await prisma.forum.findUnique({
                where: { id: params.id },
                select: { locked: true }
            });

            if (!forum) {
                set.status = 404;
                return { success: false, error: "Forum not found" };
            }

            if (forum.locked && !hasHigherTrait(user.roleSet, UserAdminTrait.ForumModerator)) {
                set.status = 403;
                return { success: false, error: "This forum is locked and does not allow new threads" };
            }

            const newThread = await prisma.forumThread.create({
                data: {
                    title: body.title,
                    content: body.content,
                    forumId: params.id,
                    createdBy: user.id,
                },
                select: { id: true }
            });

            return { success: true, threadId: newThread.id };

        } catch (error) {
            set.status = 500;
            logger.error(`ForumAPIError: Failed to create thread: ${error}`);
            return { success: false, error: "Internal Server Error" };
        }
    },
    {
        params: t.Object({ id: t.Number() }),
        body: t.Object({
            title: t.String({ minLength: 3, maxLength: 100 }),
            content: t.String({ minLength: 10, maxLength: 10000 }),
        }),
        rateLimit: { maxRequests: 1, limitSeconds: 120 },
        auth: true,
    }
);

forumsApi.post(
    "/thread/:id/new-post",
    async ({ user, params, body, set }) => {
        try {
            const thread = await prisma.forumThread.findUnique({
                where: { id: params.id },
                select: {
                    forum: {
                        select: {
                            id: true,
                            locked: true
                        }
                    },
                    hidden: true
                }
            });

            if (!thread) {
                set.status = 404;
                return { success: false, error: "Thread not found" };
            }

            if (thread.forum.locked && !hasHigherTrait(user.roleSet, UserAdminTrait.ForumModerator)) {
                set.status = 403;
                return { success: false, error: "This forum is locked and does not allow new posts" };
            }

            if (thread.hidden) {
                set.status = 403;
                return { success: false, error: "This thread is locked" };
            }

            const newPost = await prisma.forumPost.create({
                data: {
                    content: body.content,
                    threadId: params.id,
                    createdBy: user.id,
                    forumId: thread.forum.id
                },
                select: { id: true }
            });
            return { success: true, postId: newPost.id };
        } catch (error) {
            set.status = 500;
            logger.error(`ForumAPIError: Failed to create post: ${error}`);
            return { success: false, error: "Internal Server Error" };
        }
    },
    {
        params: t.Object({ id: t.Number() }),
        body: t.Object({
            content: t.String({ minLength: 10, maxLength: 10000 }),
        }),
        rateLimit: { maxRequests: 1, limitSeconds: 120 },
        auth: true,
    }
);

export default forumsApi;
