use rocket::serde::{Serialize};
use serde::Deserialize;
use resources::{image::ImageFormat, thumb::ThumbnailType};

#[derive(Serialize)]
pub struct Response {
    pub success: bool,
    pub message: &'static str,
}

#[derive(Serialize, Deserialize)]
pub struct NewGameServerRequest {
    pub place_id: i32
}

#[derive(Serialize, Deserialize)]
pub struct NewGameServerResponse {
    pub success: bool,
    pub message: String,
    pub job_id: String,
}

#[derive(Serialize, Deserialize)]
pub struct DispatchAvatarRenderingRequest {
    pub user_id: i32,
    pub hash: String,
    pub format: ImageFormat,
    pub bust: bool,
    pub sizes: Vec<SizeObject>,
}

#[derive(Serialize, Deserialize)]
pub struct DispatchAssetValidationRequest {
    pub asset_id: i32
}

#[derive(Serialize, Deserialize)]
pub struct DispatchAssetRenderingRequest {
    pub asset_id: i32,
    pub global_version_id: i32,
    pub format: ImageFormat,
    pub thumbnail_type: ThumbnailType,
    pub mannequin_or_universe_id: Option<i32>,
    pub sizes: Vec<SizeObject>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct RenewGameServerLeaseRequest {
    pub job_id: String,
    pub lease: u32,
}

#[derive(Serialize, Deserialize)]
pub struct RenewGameServerLeaseResponse {
    pub success: bool,
    pub message: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ReportedGameServerClosedRequest {
    pub job_id: String,
}

#[derive(Serialize, Deserialize)]
pub struct ReportedGameServerClosedResponse {
    pub success: bool,
    pub message: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SizeObject {
    pub width: i32,
    pub height: i32,
}

#[derive(Serialize, Deserialize)]
pub struct DispatchAvatarRenderingResponse {
    pub success: bool
}