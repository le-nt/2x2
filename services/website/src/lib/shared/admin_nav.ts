import { UserAdminTraitSafe } from "./prisma-browser";

export type NavItem = {
	href: string;
	label?: string;
	description?: string;
	minimumRole: UserAdminTraitSafe;
	externalLink?: boolean;
	hidden?: boolean;
	category?: string;
};

export const nav: NavItem[] = [
	{
		href: "/cs",
		label: "Dashboard",
		category: "Customer Service",
		minimumRole: UserAdminTraitSafe.Unprivileged, // * we handle /Admi* serverside so its ok
	},
	{
		href: "/cs/find/user",
		label: "Find user",
		category: "Customer Service",
		minimumRole: UserAdminTraitSafe.Moderator,
	},
	{
		href: "/cs/find/group",
		label: "Find group",
		category: "Customer Service",
		minimumRole: UserAdminTraitSafe.Moderator,
	},
	{
		href: "/cs/find/alts",
		label: "Alt finder",
		category: "Customer Service",
		minimumRole: UserAdminTraitSafe.Moderator,
	},
	{
		href: "/cs/find/asset",
		label: "Find asset",
		category: "Customer Service",
		minimumRole: UserAdminTraitSafe.AssetManager,
	},
	{
		href: "/cs/import-asset",
		label: "Import asset",
		category: "Customer Service",
		minimumRole: UserAdminTraitSafe.AssetManager,
	},
	{
		href: "/cs/backlog/abuse",
		label: "Pending abuse reports",
		category: "Customer Service",
		externalLink: false, // Because you leave CS&Mod and go to Backlog
		minimumRole: UserAdminTraitSafe.Moderator,
	},
	{
		href: "/cs/backlog/assets",
		label: "Asset backlog",
		category: "Customer Service",
		externalLink: false, // Because you leave CS&Mod and go to Backlog
		minimumRole: UserAdminTraitSafe.AssetManager,
	},
	{
		href: "/cs/feature-flags",
		label: "Site Features",
		category: "Web",
		minimumRole: UserAdminTraitSafe.SuperAdmin,
	},
	{
		href: "/cs/invite-codes",
		label: "Beta Codes",
		category: "Web",
		minimumRole: UserAdminTraitSafe.SuperAdmin,
	},
	{
		href: "/cs/forum-settings",
		label: "Forum Settings",
		category: "Web",
		minimumRole: UserAdminTraitSafe.SuperAdmin,
	},
	{
		href: "/cs/website/site-wide-banner",
		label: "Site-wide Banner",
		category: "Web",
		minimumRole: UserAdminTraitSafe.Administrator,
	},
	{
		href: "/cs/website/audit-log",
		label: "Audit trail",
		category: "Web",
		minimumRole: UserAdminTraitSafe.Administrator,
	},
	{
		href: "/cs/infra/machines",
		label: "Arbiter Nodes",
		category: "Infrastructure",
		minimumRole: UserAdminTraitSafe.SuperAdmin,
	},
	{
		href: "#",
		label: "Setup Admin",
		category: "Infrastructure",
		minimumRole: UserAdminTraitSafe.SuperAdmin,
		externalLink: true,
	},

	// Hidden
	{
		href: "/cs/infra/machines/new",
		minimumRole: UserAdminTraitSafe.SuperAdmin,
		hidden: true,
	},
	{
		href: "/cs/forum/moderate-post",
		minimumRole: UserAdminTraitSafe.ForumModerator,
		hidden: true,
	},
	{
		href: "/cs/forum/moderate-thread",
		minimumRole: UserAdminTraitSafe.ForumModerator,
		hidden: true,
	},
	{
		href: "/cs/useradmin/summary",
		minimumRole: UserAdminTraitSafe.Moderator,
		hidden: true,
	},
	{
		href: "/cs/useradmin/moderate",
		minimumRole: UserAdminTraitSafe.Moderator,
		hidden: true,
	},
	{
		href: "/cs/useradmin/ips",
		minimumRole: UserAdminTraitSafe.Moderator,
		hidden: true,
	}
];
