import redis from "./redis";
import FeatureType from "@/types/feature";
import prisma from "@/prisma";

export const ALL_FEAT = {
    signUpEnabled: {
        displayName: "Sign Up",
        description: "Allow new users to create accounts"
    },
    // invites: {
    //     displayName: "Invites",
    //     description: "Enable invite-only registration"
    // },
    gamesEnabled: {
        displayName: "Gameservers & WebBootstrapper",
        description: "Enables players to join games and download new clients"
    }
} as const satisfies Record<string, { displayName: string; description: string }>;

export type ValidFeatureKey = keyof typeof ALL_FEAT;
async function getCachedFeatures(): Promise<FeatureType[]> {
    const cached = await redis.get("features");
    if (cached) return JSON.parse(cached);
    return await refreshCache();
}

async function refreshCache() {
    const features = await prisma.siteFeature.findMany();
    const formatted = features.map(f => ({ key: f.key, enabled: f.enabled }));
    
    await redis.set("features", JSON.stringify(formatted), "EX", 3600);
    return formatted;
}

async function check(key: ValidFeatureKey): Promise<boolean> {
    const features = await getCachedFeatures();
    return features.find(f => f.key === key)?.enabled ?? false;
}

type FeatureAccessors = {
    [K in ValidFeatureKey]: Promise<boolean>;
};

const feature = {} as FeatureAccessors;

(Object.keys(ALL_FEAT) as ValidFeatureKey[]).forEach((key) => {
    Object.defineProperty(feature, key, {
        get: () => check(key),
        enumerable: true,
    });
});

const admin = {
    async set(key: ValidFeatureKey, enabled: boolean) {
        await prisma.siteFeature.upsert({
            where: { key },
            update: { enabled },
            create: { key, enabled }
        });
        await refreshCache();
    },
    getAll: getCachedFeatures,
    getAllWithMetadata: async () => {
        const features = await getCachedFeatures();
        return Object.entries(ALL_FEAT).map(([key, meta]) => ({
            key: key as ValidFeatureKey,
            enabled: features.find((f) => f.key === key)?.enabled ?? false,
            ...meta,
        }));
    },
    isValid: (key: string): key is ValidFeatureKey => key in ALL_FEAT
};

export default { feature, admin, isFeatureEnabled: check };