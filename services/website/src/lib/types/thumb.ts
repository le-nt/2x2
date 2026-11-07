export enum ImageType {
    Asset = 0,
    Avatar,
    AvatarHeadShot,
    Game, // this is only used for sizes, DB still stores Asset
}

export enum ThumbnailType {
    Avatar = 1,
    AvatarHeadShot,

    // Asset
    Face,
    Decal,
    Gear,
    Hat,
    Head,
    MeshPart,
    Mesh,
    Model,
    Package,
    Pants,
    Place,
    Shirt,
}

const dimensions: Record<ImageType, { width: number; height: number }[]> = {
    [ImageType.Asset]: [
        { width: 110, height: 110 },
        { width: 140, height: 140 },
        { width: 420, height: 420 },
    ],
    [ImageType.Avatar]: [
        { width: 100, height: 100 },
        { width: 352, height: 352 },
        { width: 720, height: 720 },
    ],
    [ImageType.AvatarHeadShot]: [
        { width: 48, height: 48 },
        { width: 60, height: 60 },
        { width: 100, height: 100 },
        { width: 150, height: 150 },
        { width: 180, height: 180 },
    ],
    /*[Type.BadgeIcon]: [
        { width: 150, height: 150 },
    ],
    [Type.BundleThumbnail]: [
        { width: 150, height: 150 },
        { width: 420, height: 420 },
    ],*/
    [ImageType.Game]: [
        { height: 115, width: 210 },
        { width: 140, height: 140 },
        { width: 240, height: 240 },
        { width: 352, height: 352 },
        { width: 768, height: 432 }
    ],
    /*[Type.GamePass]: [
        { width: 150, height: 150 },
    ],
    [Type.GroupIcon]: [
        { width: 150, height: 150 },
        { width: 420, height: 420 },
    ],
    [Type.Outfit]: [
        { width: 150, height: 150 },
        { width: 420, height: 420 },
    ],*/
};

export function getDimensions(type: ImageType): { width: number; height: number }[] {
    return dimensions[type];
}

export function findBySize(
    type: ImageType,
    width: number,
    height: number
): { width: number; height: number } | null {
    return dimensions[type].find(d => d.width === width && d.height === height) ?? null;
}