import {
	UserAdminTraitSafe,
	userAdminTraitRank,
} from "@shared/prisma-browser";
import type { UserAdminTrait as UserAdminTraitServer } from "@prisma/client";

const adminTraitLabels: Partial<Record<UserAdminTraitSafe, string>> = {
	[UserAdminTraitSafe.AssetManager]: "Asset Moderator",
	[UserAdminTraitSafe.ForumModerator]: "Forum Moderator",
	[UserAdminTraitSafe.Moderator]: "Moderator",
	[UserAdminTraitSafe.Administrator]: "Administrator",
	[UserAdminTraitSafe.SuperAdmin]: "Administrator",
};

export function hasHigherTrait(
	userTrait: UserAdminTraitSafe | UserAdminTraitServer,
	requiredTrait: UserAdminTraitSafe | UserAdminTraitServer,
): boolean {
	return userAdminTraitRank[userTrait] >= userAdminTraitRank[requiredTrait];
}

export function formatTrait(trait: UserAdminTraitSafe | UserAdminTraitServer): string {
	return adminTraitLabels[trait] ?? "";
}
