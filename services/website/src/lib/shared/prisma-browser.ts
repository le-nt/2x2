export enum UserAdminTraitSafe {
    Unprivileged = "Unprivileged",
    ProtectedUser = "ProtectedUser",
    AssetManager = "AssetManager",
    ForumModerator = "ForumModerator",
    Moderator = "Moderator",
    Administrator = "Administrator",
    SuperAdmin = "SuperAdmin",
}

export const userAdminTraitRank: Record<UserAdminTraitSafe, number> = {
    [UserAdminTraitSafe.Unprivileged]: 0,
    [UserAdminTraitSafe.ProtectedUser]: 1,
    [UserAdminTraitSafe.ForumModerator]: 2,
    [UserAdminTraitSafe.AssetManager]: 3,
    [UserAdminTraitSafe.Moderator]: 4,
    [UserAdminTraitSafe.Administrator]: 5,
    [UserAdminTraitSafe.SuperAdmin]: 255,
};

export const EscalationSafe = {
    Unban: 'Unban',
    Warn: 'Warn',
    Remind: 'Remind',
    Ban_1Day: 'Ban_1Day',
    Ban_3Day: 'Ban_3Day',
    Ban_7Day: 'Ban_7Day',
    Ban_14Day: 'Ban_14Day',
    Delete: 'Delete'
};

export function escalationToUserFriendly(escalation: string): string {
    switch (escalation) {
        case EscalationSafe.Unban:
            return "";
        case EscalationSafe.Warn:
            return "Warning";
        case EscalationSafe.Remind:
            return "Reminder";
        case EscalationSafe.Ban_1Day:
            return "Banned for 1 Day";
        case EscalationSafe.Ban_3Day:
            return "Banned for 3 Days";
        case EscalationSafe.Ban_7Day:
            return "Banned for 7 Days";
        case EscalationSafe.Ban_14Day:
            return "Banned for 14 Days";
        case EscalationSafe.Delete:
            return "Account Deleted";
        default:
            return "";
    }
}

export enum ForumCategorySafe {
    Roblox = "Roblox",
    ClubHouses = "ClubHouses",
    GameCreationAndDevelopment = "GameCreationAndDevelopment",
    Entertainment = "Entertainment",
}

export enum ChatStyleSafe {
    Classic = "Classic",
    Bubble = "Bubble",
    ClassicAndBubble = "ClassicAndBubble",
}

export enum DeviceSafe {
    Computer = "Computer",
    Phone = "Phone",
    Tablet = "Tablet",
}

export type SessionSafe = {
    id: string;
    userId: number;
    expiresAt: Date | string;
};

export type UserSafe = {
    id: number;
    username: string;
    robux: bigint;
    tickets: bigint;
    roleSet: UserAdminTraitSafe;
    totpEnrolled?: boolean;
};
