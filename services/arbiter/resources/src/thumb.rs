use serde::{Deserialize, Serialize};
use std::convert::TryFrom;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub enum ThumbnailType {
    Avatar = 1,
    AvatarHeadShot,

    // Face and decal are handled with the same lua script
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

impl<'de> Deserialize<'de> for ThumbnailType {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        let value = u32::deserialize(deserializer)?;
        ThumbnailType::try_from(value).map_err(serde::de::Error::custom)
    }
}

impl TryFrom<u32> for ThumbnailType {
    type Error = String;

    fn try_from(value: u32) -> Result<Self, Self::Error> {
        match value {
            1 => Ok(ThumbnailType::Avatar),
            2 => Ok(ThumbnailType::AvatarHeadShot),
            3 => Ok(ThumbnailType::Face),
            4 => Ok(ThumbnailType::Decal),
            5 => Ok(ThumbnailType::Gear),
            6 => Ok(ThumbnailType::Hat),
            7 => Ok(ThumbnailType::Head),
            8 => Ok(ThumbnailType::MeshPart),
            9 => Ok(ThumbnailType::Mesh),
            10 => Ok(ThumbnailType::Model),
            11 => Ok(ThumbnailType::Package),
            12 => Ok(ThumbnailType::Pants),
            13 => Ok(ThumbnailType::Place),
            14 => Ok(ThumbnailType::Shirt),
            _ => Err(format!("Invalid ThumbnailType value: {}", value)),
        }
    }
}

pub fn get_script_by_thumbnail_type(thumbnail_type: ThumbnailType) -> &'static str {
    match thumbnail_type {
        ThumbnailType::Avatar => include_str!("../scripts/Render/AvatarScript.lua"),
        ThumbnailType::AvatarHeadShot => include_str!("../scripts/Render/AvatarHeadShotScript.lua"),
        ThumbnailType::Face 
        | ThumbnailType::Decal => include_str!("../scripts/Render/FaceScript.lua"),
        ThumbnailType::Gear => include_str!("../scripts/Render/GearScript.lua"),
        ThumbnailType::Hat => include_str!("../scripts/Render/HatScript.lua"),
        ThumbnailType::Head => include_str!("../scripts/Render/HeadScript.lua"),
        ThumbnailType::MeshPart => include_str!("../scripts/Render/MeshPartScript.lua"),
        ThumbnailType::Mesh => include_str!("../scripts/Render/MeshScript.lua"),
        ThumbnailType::Model => include_str!("../scripts/Render/ModelScript.lua"),
        ThumbnailType::Package => include_str!("../scripts/Render/PackageScript.lua"),
        ThumbnailType::Pants => include_str!("../scripts/Render/PantsScript.lua"),
        ThumbnailType::Place => include_str!("../scripts/Render/PlaceScript.lua"),
        ThumbnailType::Shirt => include_str!("../scripts/Render/ShirtScript.lua"),
    }
}