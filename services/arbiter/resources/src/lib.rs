
/**
 * Resources for the Arbiter.
 * e.g Scripts, ThumbnailTypes, ThumbnailSizes, etc.
 */
use crate::{image::ImageFormat, thumb::ThumbnailType};


pub mod thumb;
pub mod image;

#[derive(Clone, Debug)]
pub enum LuaArg {
    String(String),
    Number(i32),
    Float(f32),
    Boolean(bool),
    Nil,
}

pub fn get_gameserver_script() -> &'static str {
    include_str!("../scripts/GameServer.lua")
}

pub fn get_validation_script() -> &'static str {
    include_str!("../scripts/Validate.lua")
}

pub fn get_script_args(
    thumbnail_type: ThumbnailType,
    img_format: ImageFormat,
    width: i32,
    height: i32,
    other_args: Vec<LuaArg>,
) -> Vec<LuaArg> {
    match thumbnail_type {
        ThumbnailType::Avatar => {
            let mut args = Vec::new();
            args.extend(other_args); // unpack charapp, baseUrl
            args.push(LuaArg::String(img_format.to_string()));
            args.push(LuaArg::Number(width));
            args.push(LuaArg::Number(height));
            args
        }

        ThumbnailType::AvatarHeadShot => {
            let mut args = Vec::new();

            let base_url = other_args.get(0).cloned().unwrap_or(LuaArg::Nil);
            let char_appearance = other_args.get(1).cloned().unwrap_or(LuaArg::Nil);

            args.push(base_url);
            args.push(char_appearance);
            args.push(LuaArg::String(img_format.to_string()));
            args.push(LuaArg::Number(width));
            args.push(LuaArg::Number(height));

            if other_args.len() > 2 {
                args.extend(other_args.into_iter().skip(2)); // quadratic, baseHatZoom, etc.
            }
            args
        }

        ThumbnailType::Face
        | ThumbnailType::Decal
        | ThumbnailType::Gear
        | ThumbnailType::Hat
        | ThumbnailType::Head
        | ThumbnailType::MeshPart
        | ThumbnailType::Mesh
        | ThumbnailType::Model
        | ThumbnailType::Pants
        | ThumbnailType::Place
        | ThumbnailType::Shirt => {
            let mut args = Vec::new();

            let asset_url = other_args.get(0).cloned().unwrap_or(LuaArg::Nil);
            let base_url = other_args.get(1).cloned().unwrap_or(LuaArg::Nil);

            args.push(asset_url);
            args.push(LuaArg::String(img_format.to_string()));
            args.push(LuaArg::Number(width));
            args.push(LuaArg::Number(height));
            args.push(base_url);

            if matches!(
                thumbnail_type,
                ThumbnailType::Head
                    | ThumbnailType::Pants
                    | ThumbnailType::Place
                    | ThumbnailType::Shirt
            ) {
                if let Some(extra) = other_args.get(2).cloned() {
                    args.push(extra); // mannequinId or universeId
                }
            }
            args
        }

        _ => {
            panic!("Unknown thumbnail type {:?}", thumbnail_type);
        }
    }
}