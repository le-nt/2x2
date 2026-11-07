use crate::{acl, admin_ui, auth, r2, version};
use actix_web::{HttpResponse, Responder, web};
use aws_sdk_s3::{presigning::PresigningConfig, types::ChecksumMode};
use entity::{app, channel, deployment};
use sea_orm::{
    ActiveModelTrait, ActiveValue::Set, ColumnTrait, EntityTrait, FromQueryResult, JoinType,
    QueryFilter, QueryOrder, QuerySelect, RelationTrait,
};
use serde::Deserialize;
use serde::Serialize;
use std::time::Duration;

#[derive(Deserialize)]
pub struct DownloadQuery {
    app_name: String,
    channel_name: String,
    deployment_id: Option<String>,
}
#[derive(Deserialize)]
pub struct DeploymentsQuery {
    app_name: Option<String>,
    channel_name: Option<String>,
}
#[derive(Deserialize)]
pub struct LatestVersionQuery {
    app_name: String,
    channel_name: String,
}
#[derive(Deserialize)]
pub struct LcfaQuery {
    app_name: String,
}

#[derive(Debug, FromQueryResult)]
struct DeploymentHistoryInfo {
    id: String,
    created_at: chrono::NaiveDateTime,
    is_done: bool,
    is_available: bool,
    app_name: String,
    channel_name: String,
}

async fn health_check() -> impl Responder {
    HttpResponse::Ok().body("OK\nHumans see /info and /DeployHistory.txt for more details")
}

#[derive(Serialize)]
struct MyPermissionsResponse {
    role: String,
    is_override: bool,
    privileges: Vec<&'static str>,
}

async fn my_permissions(req: actix_web::HttpRequest) -> impl Responder {
    let user_context = auth::get_user_context(&req);
    let all_privs = [
        "app.read",
        "app.write",
        "channel.read",
        "channel.write",
        "deployment.read",
        "deployment.write",
    ];
    let mut granted: Vec<&'static str> = all_privs
        .iter()
        .cloned()
        .filter(|p| acl::is_allowed(&user_context.role, None, Some(p)))
        .collect();
    granted.sort();
    HttpResponse::Ok().json(MyPermissionsResponse {
        role: user_context.role,
        is_override: user_context.is_override,
        privileges: granted,
    })
}

async fn info() -> impl Responder {
    let version = version::get_version();
    let info_text = format!(
        "deployserv {}\nThis is the Deployment Service.\nWe use it to upload & download files from our setup bucket on Cloudflare R2.\nhttps://www.github.com/MoonicTeam",
        version
    );
    HttpResponse::Ok().body(info_text)
}

async fn list_apps_json(
    req: actix_web::HttpRequest,
    db: web::Data<sea_orm::DatabaseConnection>,
) -> impl Responder {
    let user_context = auth::get_user_context(&req);

    if !acl::can_read_apps(&user_context.role) {
        return HttpResponse::Unauthorized().json(serde_json::json!({
            "error": "Insufficient permissions to read apps"
        }));
    }

    let db = db.get_ref();
    match entity::app::Entity::find().all(db).await {
        Ok(apps) => HttpResponse::Ok().json(apps),
        Err(e) => {
            println!("Database error while fetching apps: {}", e);
            HttpResponse::InternalServerError().json(serde_json::json!({ "error": "db error" }))
        }
    }
}

async fn list_channels_for_app_json(
    req: actix_web::HttpRequest,
    query: web::Query<LcfaQuery>,
    db: web::Data<sea_orm::DatabaseConnection>,
) -> impl Responder {
    let db = db.get_ref();
    match entity::app::Entity::find()
        .filter(entity::app::Column::Name.eq(&query.app_name))
        .one(db)
        .await
    {
        Ok(Some(app)) => {
            let channels_query =
                channel::Entity::find().filter(channel::Column::AppId.eq(app.id));
            match channels_query.all(db).await {
                Ok(channels) => HttpResponse::Ok().json(channels),
                Err(e) => {
                    println!("Database error while fetching channels: {}", e);
                    HttpResponse::InternalServerError()
                        .json(serde_json::json!({ "error": "db error" }))
                }
            }
        }
        Ok(None) => HttpResponse::NotFound().json(serde_json::json!({ "error": "App not found" })),
        Err(e) => {
            println!("Database error while fetching app: {}", e);
            HttpResponse::InternalServerError().json(serde_json::json!({ "error": "db error" }))
        }
    }
}

async fn deployhistory(db: web::Data<sea_orm::DatabaseConnection>) -> impl Responder {
    let db = db.get_ref();

    match deployment::Entity::find()
        .select_only()
        .column(deployment::Column::Id)
        .column(deployment::Column::CreatedAt)
        .column(deployment::Column::IsDone)
        .column(deployment::Column::IsAvailable)
        .column_as(app::Column::Name, "app_name")
        .column_as(channel::Column::Name, "channel_name")
        .join(JoinType::InnerJoin, deployment::Relation::App.def())
        .join(JoinType::InnerJoin, deployment::Relation::Channel.def())
        .order_by_desc(deployment::Column::CreatedAt)
        .into_model::<DeploymentHistoryInfo>()
        .all(db)
        .await
    {
        Ok(deployments) => {
            if deployments.is_empty() {
                return HttpResponse::Ok().body("No DeployHistory available");
            }

            let response_body = deployments
                .into_iter()
                .map(|deployment_info| {
                    let availability = if deployment_info.is_done {
                        if deployment_info.is_available {
                            "Done!"
                        } else {
                            "Unavailable"
                        }
                    } else {
                        "Waiting..."
                    };
                    format!(
                        "New {} version-{} (channel:{}) at {}... {}\n",
                        deployment_info.app_name,
                        deployment_info.id,
                        deployment_info.channel_name,
                        deployment_info.created_at,
                        availability
                    )
                })
                .collect::<String>();

            HttpResponse::Ok().body(response_body)
        }
        Err(e) => {
            println!("Failed to fetch deployment history: {}", e);
            HttpResponse::InternalServerError()
                .json(serde_json::json!({ "error": "Failed to fetch deployment history" }))
        }
    }
}

async fn get_download_url(
    query: web::Query<DownloadQuery>,
    db: web::Data<sea_orm::DatabaseConnection>,
    req: actix_web::HttpRequest,
) -> impl Responder {
    let db = db.get_ref();

    let app = match entity::app::Entity::find()
        .filter(entity::app::Column::Name.eq(&query.app_name))
        .one(db)
        .await
    {
        Ok(Some(app)) => app,
        Ok(None) => {
            return HttpResponse::NotFound().json(serde_json::json!({ "error": "App not found" }));
        }
        Err(e) => {
            println!("Database error while fetching app: {}", e);
            return HttpResponse::InternalServerError()
                .json(serde_json::json!({ "error": "db error" }));
        }
    };

    let channel = match channel::Entity::find()
        .filter(channel::Column::AppId.eq(app.id))
        .filter(channel::Column::Name.eq(&query.channel_name))
        .one(db)
        .await
    {
        Ok(Some(channel)) => {
            if !channel.public {
                let user_context = auth::get_user_context(&req);
                let channel_resource = acl::channel_resource(&channel.id.to_string());

                if acl::is_denied(
                    &user_context.role,
                    Some(&channel_resource),
                    Some("channel.read"),
                ) {
                    return HttpResponse::Unauthorized().json(serde_json::json!({ "error": "Insufficient permissions to access private channel" }));
                }
            }
            channel
        }
        Ok(None) => {
            return HttpResponse::NotFound()
                .json(serde_json::json!({ "error": "Channel not found" }));
        }
        Err(e) => {
            println!("Database error while fetching channel: {}", e);
            return HttpResponse::InternalServerError()
                .json(serde_json::json!({ "error": "db error" }));
        }
    };

    let mut deployment_query = deployment::Entity::find()
        .filter(deployment::Column::AppId.eq(app.id))
        .filter(deployment::Column::ChannelId.eq(channel.id))
        .filter(deployment::Column::IsDone.eq(true))
        .filter(deployment::Column::IsAvailable.eq(true));

    if let Some(ref deployment_id) = query.deployment_id {
        let clean_id = deployment_id
            .strip_prefix("version-")
            .unwrap_or(deployment_id);
        deployment_query = deployment_query.filter(deployment::Column::Id.eq(clean_id));
    } else {
        deployment_query = deployment_query.order_by_desc(deployment::Column::CreatedAt);
    }

    match deployment_query.one(db).await {
        Ok(Some(deployment)) => {
            let s3_client = r2::get_s3_client().await;
            let bucket_name = &crate::cfg::get_config().r2.bucket;
            let presigning_config = PresigningConfig::builder()
                .expires_in(Duration::from_secs(3600))
                .build()
                .expect("Failed to build presigning configuration");
            let presigned_request = s3_client
                .get_object()
                .key(format!(
                    "{}/{}/{}",
                    deployment.app_id, deployment.channel_id, deployment.filename
                ))
                .bucket(bucket_name)
                .presigned(presigning_config)
                .await
                .expect("Failed to presign URL");
            HttpResponse::Ok().json(serde_json::json!({ "url": presigned_request.uri().to_string(), "verify": deployment.sha1 }))
        }
        Ok(None) => {
            HttpResponse::NotFound().json(serde_json::json!({ "error": "Unavailable deployment" }))
        }
        Err(e) => {
            println!(
                "Database error while fetching deployment for download: {}",
                e
            );
            HttpResponse::InternalServerError().json(serde_json::json!({ "error": "db error" }))
        }
    }
}

async fn get_deployments(
    query: web::Query<DeploymentsQuery>,
    db: web::Data<sea_orm::DatabaseConnection>,
) -> impl Responder {
    let db = db.get_ref();
    let mut deployments_query = deployment::Entity::find()
        .join(JoinType::InnerJoin, deployment::Relation::Channel.def())
        .order_by_desc(deployment::Column::CreatedAt);

    if let Some(ref app_name) = query.app_name {
        deployments_query = deployments_query
            .join(JoinType::InnerJoin, deployment::Relation::App.def())
            .filter(entity::app::Column::Name.eq(app_name));
    }

    if let Some(ref channel_name) = query.channel_name {
        deployments_query = deployments_query.filter(channel::Column::Name.eq(channel_name));
    }

    match deployments_query.all(db).await {
        Ok(deployments) => HttpResponse::Ok().json(deployments),
        Err(e) => {
            println!("Database error while fetching deployments: {}", e);
            HttpResponse::InternalServerError().json(serde_json::json!({ "error": "db error" }))
        }
    }
}

async fn upload_stage1(req: actix_web::HttpRequest) -> impl Responder {
    let user_context = auth::get_user_context(&req);
    if !acl::can_write_deployment(&user_context.role, None) {
        return HttpResponse::Forbidden().json(
            serde_json::json!({"error": "Insufficient permissions (deployment.write required)"}),
        );
    }
    let headers = req.headers();
    let app_name = headers.get("X-App-Name").and_then(|h| h.to_str().ok());
    let channel_name = headers.get("X-Channel-Name").and_then(|h| h.to_str().ok());
    let sha1 = headers.get("X-SHA1").and_then(|h| h.to_str().ok());

    if app_name.is_none() || channel_name.is_none() || sha1.is_none() {
        return HttpResponse::BadRequest().json(serde_json::json!({ "error": "Missing required headers: X-App-Name, X-Channel-Name, X-SHA1" }));
    }
    let app_name = app_name.unwrap();
    let channel_name = channel_name.unwrap();
    let sha1 = sha1.unwrap();

    let db = req
        .app_data::<web::Data<sea_orm::DatabaseConnection>>()
        .unwrap();
    let db = db.get_ref();

    let app = match entity::app::Entity::find()
        .filter(entity::app::Column::Name.eq(app_name))
        .one(db)
        .await
    {
        Ok(Some(app)) => app,
        Ok(None) => {
            return HttpResponse::NotFound().json(serde_json::json!({ "error": "App not found" }));
        }
        Err(e) => {
            println!("Database error while fetching app: {}", e);
            return HttpResponse::InternalServerError()
                .json(serde_json::json!({ "error": "db error" }));
        }
    };

    let channel = match channel::Entity::find()
        .filter(channel::Column::AppId.eq(app.id))
        .filter(channel::Column::Name.eq(channel_name))
        .one(db)
        .await
    {
        Ok(Some(channel)) => channel,
        Ok(None) => {
            return HttpResponse::NotFound()
                .json(serde_json::json!({ "error": "Channel not found" }));
        }
        Err(e) => {
            println!("Database error while fetching channel: {}", e);
            return HttpResponse::InternalServerError()
                .json(serde_json::json!({ "error": "db error" }));
        }
    };

    let deployment_exists = deployment::Entity::find()
        .filter(deployment::Column::AppId.eq(app.id))
        .filter(deployment::Column::ChannelId.eq(channel.id))
        .filter(deployment::Column::IsDone.eq(false))
        .one(db)
        .await;
    if let Ok(Some(_)) = deployment_exists {
        return HttpResponse::Conflict().json(serde_json::json!({ "error": "A deployment is already in progress for this app/channel. Wait until it is finished, or delete it." }));
    }

    let deployment_uuid = uuid::Uuid::new_v4().to_string();
    let version_hash = format!("{:016x}", crc64::crc64(0, deployment_uuid.as_bytes()));
    let file_hash = uuid::Uuid::new_v4().to_string();
    let filename_hash = format!("{:016x}", crc64::crc64(0, file_hash.as_bytes()));
    let filename = format!("{}{}.{}", app_name, filename_hash.to_uppercase(), "tar.xz");
    let filepath = format!("{}/{}/{}", app.id, channel.id, filename);

    let new_deployment = deployment::ActiveModel {
        id: Set(version_hash.clone()),
        filename: Set(filename.clone()),
        sha1: Set(sha1.to_string()),
        created_at: Set(chrono::Utc::now().naive_utc()),
        channel_id: Set(channel.id),
        app_id: Set(app.id),
        is_done: Set(false),
        is_available: Set(false),
    };
    if let Err(e) = deployment::Entity::insert(new_deployment).exec(db).await {
        println!("Database error while inserting new deployment: {}", e);
        return HttpResponse::InternalServerError()
            .json(serde_json::json!({ "error": "db error" }));
    }

    let s3_client = r2::get_s3_client().await;
    let bucket_name = &crate::cfg::get_config().r2.bucket;
    let presigning_config = PresigningConfig::builder()
        .expires_in(Duration::from_secs(3600))
        .build()
        .expect("Failed to build presigning configuration");
    let presigned_request = s3_client
        .put_object()
        .bucket(bucket_name)
        .key(filepath)
        .checksum_sha1(sha1.to_string())
        .content_type("application/x-xz")
        .presigned(presigning_config)
        .await;

    match presigned_request {
        Ok(req) => HttpResponse::Ok().json(serde_json::json!({
            "id": format!("version-{}", version_hash),
            "filename": filename.clone(),
            "url": req.uri().to_string(),
            "verify": sha1,
            "expiry": 3600,
            "reportTo": "/api/upload/report"
        })),
        Err(e) => {
            println!("Failed to presign URL: {}", e);
            HttpResponse::InternalServerError()
                .json(serde_json::json!({ "error": "Failed to presign URL" }))
        }
    }
}

async fn upload_stage2(req: actix_web::HttpRequest) -> impl Responder {
    let user_context = auth::get_user_context(&req);
    if !acl::can_write_deployment(&user_context.role, None) {
        return HttpResponse::Forbidden().json(
            serde_json::json!({"error": "Insufficient permissions (deployment.write required)"}),
        );
    }
    let deployment_id = req
        .headers()
        .get("X-Deployment-Id")
        .and_then(|h| h.to_str().ok());
    if deployment_id.is_none() {
        return HttpResponse::BadRequest()
            .json(serde_json::json!({ "error": "Missing X-Deployment-Id header" }));
    }
    let deployment_id = deployment_id.unwrap();
    let clean_id = deployment_id
        .strip_prefix("version-")
        .unwrap_or(deployment_id);
    let db = req
        .app_data::<web::Data<sea_orm::DatabaseConnection>>()
        .unwrap();
    let db = db.get_ref();

    let deployment = match deployment::Entity::find_by_id(clean_id).one(db).await {
        Ok(Some(deployment)) => deployment,
        Ok(None) => {
            return HttpResponse::NotFound()
                .json(serde_json::json!({ "error": "Deployment not found" }));
        }
        Err(e) => {
            println!("Database error while fetching deployment: {}", e);
            return HttpResponse::InternalServerError()
                .json(serde_json::json!({ "error": "db error" }));
        }
    };

    if deployment.is_done {
        return HttpResponse::Conflict()
            .json(serde_json::json!({ "error": "Deployment is already done" }));
    }

    let s3_client = r2::get_s3_client().await;
    let bucket_name = &crate::cfg::get_config().r2.bucket;
    let filepath = format!(
        "{}/{}/{}",
        deployment.app_id, deployment.channel_id, deployment.filename
    );

    let head_object_output = match s3_client
        .head_object()
        .bucket(bucket_name)
        .key(&filepath)
        .checksum_mode(ChecksumMode::Enabled)
        .send()
        .await
    {
        Ok(output) => output,
        Err(_) => {
            return HttpResponse::NotFound()
                .json(serde_json::json!({"error": "File not found in storage"}));
        }
    };

    let actual_sha1 = match head_object_output.checksum_sha1() {
        Some(checksum) => checksum.to_string(),
        None => {
            return HttpResponse::InternalServerError().json(
                serde_json::json!({"error": "Could not retrieve checksum from uploaded file"}),
            );
        }
    };

    if actual_sha1 == deployment.sha1 {
        let mut deployment_to_update: deployment::ActiveModel = deployment.into();
        deployment_to_update.is_done = Set(true);
        deployment_to_update.is_available = Set(true);
        match deployment::Entity::update(deployment_to_update)
            .exec(db)
            .await
        {
            Ok(_) => HttpResponse::Ok().json(serde_json::json!({"status": "verified"})),
            Err(e) => {
                println!("Database error while updating deployment: {}", e);
                HttpResponse::InternalServerError().json(serde_json::json!({ "error": "db error" }))
            }
        }
    } else {
        s3_client
            .delete_object()
            .bucket(bucket_name)
            .key(&filepath)
            .send()
            .await
            .ok();
        HttpResponse::Conflict()
            .json(serde_json::json!({"error": "Verification failed. Checksum mismatch."}))
    }
}

async fn get_latest_version(
    req: actix_web::HttpRequest,
    query: web::Query<LatestVersionQuery>,
    db: web::Data<sea_orm::DatabaseConnection>,
) -> impl Responder {
    let db = db.get_ref();

    let app = match entity::app::Entity::find()
        .filter(entity::app::Column::Name.eq(&query.app_name))
        .one(db)
        .await
    {
        Ok(Some(app)) => app,
        Ok(None) => {
            return HttpResponse::NotFound().json(serde_json::json!({ "error": "App not found" }));
        }
        Err(e) => {
            println!("Database error while fetching app: {}", e);
            return HttpResponse::InternalServerError()
                .json(serde_json::json!({ "error": "db error" }));
        }
    };

    let channel = match channel::Entity::find()
        .filter(channel::Column::AppId.eq(app.id))
        .filter(channel::Column::Name.eq(&query.channel_name))
        .one(db)
        .await
    {
        Ok(Some(channel)) => {
            if !channel.public {
                let user_context = auth::get_user_context(&req);
                let channel_resource = acl::channel_resource(&channel.id.to_string());
                if acl::is_denied(
                    &user_context.role,
                    Some(&channel_resource),
                    Some("channel.read"),
                ) {
                    return HttpResponse::Unauthorized().json(serde_json::json!({ "error": "Insufficient permissions to access private channel" }));
                }
            }
            channel
        }
        Ok(None) => {
            return HttpResponse::NotFound()
                .json(serde_json::json!({ "error": "Channel not found" }));
        }
        Err(e) => {
            println!("Database error while fetching channel: {}", e);
            return HttpResponse::InternalServerError()
                .json(serde_json::json!({ "error": "db error" }));
        }
    };

    match deployment::Entity::find()
        .filter(deployment::Column::AppId.eq(app.id))
        .filter(deployment::Column::ChannelId.eq(channel.id))
        .order_by_desc(deployment::Column::CreatedAt)
        .one(db)
        .await
    {
        Ok(Some(deployment)) => HttpResponse::Ok()
            .json(serde_json::json!({ "version": format!("version-{}", deployment.id) })),
        Ok(None) => HttpResponse::NotFound()
            .json(serde_json::json!({ "error": "No deployment found for this app/channel" })),
        Err(e) => {
            println!("Database error while fetching latest version: {}", e);
            HttpResponse::InternalServerError().json(serde_json::json!({ "error": "db error" }))
        }
    }
}

#[derive(Deserialize)]
pub struct CreateAppRequest {
    name: String,
}

#[derive(Deserialize)]
pub struct CreateChannelRequest {
    name: String,
    app_name: String,
    public: bool,
}

async fn create_app(
    json: web::Json<CreateAppRequest>,
    req: actix_web::HttpRequest,
    db: web::Data<sea_orm::DatabaseConnection>,
) -> impl Responder {
    let user_context = auth::get_user_context(&req);

    if !acl::can_write_apps(&user_context.role) {
        return HttpResponse::Unauthorized().json(serde_json::json!({
            "error": "Insufficient permissions to create apps"
        }));
    }

    let db = db.get_ref();

    match app::Entity::find()
        .filter(app::Column::Name.eq(&json.name))
        .one(db)
        .await
    {
        Ok(Some(_)) => {
            return HttpResponse::Conflict().json(serde_json::json!({
                "error": "App with this name already exists"
            }));
        }
        Ok(None) => {}
        Err(e) => {
            println!("Database error while checking app: {}", e);
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Database error"
            }));
        }
    }

    let new_app = app::ActiveModel {
        id: Set(uuid::Uuid::new_v4()),
        name: Set(json.name.clone()),
    };

    match app::Entity::insert(new_app).exec(db).await {
        Ok(_) => HttpResponse::Created().json(serde_json::json!({
            "message": "App created successfully",
            "name": json.name
        })),
        Err(e) => {
            println!("Database error while creating app: {}", e);
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to create app"
            }))
        }
    }
}

async fn delete_app(
    path: web::Path<String>,
    req: actix_web::HttpRequest,
    db: web::Data<sea_orm::DatabaseConnection>,
) -> impl Responder {
    let user_context = auth::get_user_context(&req);

    if !acl::can_write_apps(&user_context.role) {
        return HttpResponse::Unauthorized().json(serde_json::json!({
            "error": "Insufficient permissions to delete apps"
        }));
    }

    let app_name = path.into_inner();
    let db = db.get_ref();

    match app::Entity::find()
        .filter(app::Column::Name.eq(&app_name))
        .one(db)
        .await
    {
        Ok(Some(app_model)) => match app::Entity::delete_by_id(app_model.id).exec(db).await {
            Ok(_) => HttpResponse::Ok().json(serde_json::json!({
                "message": "App deleted successfully"
            })),
            Err(e) => {
                println!("Database error while deleting app: {}", e);
                HttpResponse::InternalServerError().json(serde_json::json!({
                    "error": "Failed to delete app"
                }))
            }
        },
        Ok(None) => HttpResponse::NotFound().json(serde_json::json!({
            "error": "App not found"
        })),
        Err(e) => {
            println!("Database error while finding app: {}", e);
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Database error"
            }))
        }
    }
}

async fn create_channel(
    json: web::Json<CreateChannelRequest>,
    req: actix_web::HttpRequest,
    db: web::Data<sea_orm::DatabaseConnection>,
) -> impl Responder {
    let user_context = auth::get_user_context(&req);

    if !acl::can_write_channel(&user_context.role, None) {
        return HttpResponse::Unauthorized().json(serde_json::json!({
            "error": "Insufficient permissions to create channels"
        }));
    }

    let db = db.get_ref();
    let app_model = match app::Entity::find()
        .filter(app::Column::Name.eq(&json.app_name))
        .one(db)
        .await
    {
        Ok(Some(app)) => app,
        Ok(None) => {
            return HttpResponse::NotFound().json(serde_json::json!({
                "error": "App not found"
            }));
        }
        Err(e) => {
            println!("Database error while finding app: {}", e);
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Database error"
            }));
        }
    };

    match channel::Entity::find()
        .filter(channel::Column::AppId.eq(app_model.id))
        .filter(channel::Column::Name.eq(&json.name))
        .one(db)
        .await
    {
        Ok(Some(_)) => {
            return HttpResponse::Conflict().json(serde_json::json!({
                "error": "Channel with this name already exists for this app"
            }));
        }
        Ok(None) => {}
        Err(e) => {
            println!("Database error while checking channel: {}", e);
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Database error"
            }));
        }
    }

    let new_channel = channel::ActiveModel {
        id: Set(uuid::Uuid::new_v4()),
        name: Set(json.name.clone()),
        app_id: Set(app_model.id),
        public: Set(json.public),
        default: Set(false),
    };

    match channel::Entity::insert(new_channel).exec(db).await {
        Ok(_) => HttpResponse::Created().json(serde_json::json!({
            "message": "Channel created successfully",
            "name": json.name,
            "app_name": json.app_name
        })),
        Err(e) => {
            println!("Database error while creating channel: {}", e);
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to create channel"
            }))
        }
    }
}

async fn delete_channel(
    path: web::Path<(String, String)>,
    req: actix_web::HttpRequest,
    db: web::Data<sea_orm::DatabaseConnection>,
) -> impl Responder {
    let user_context = auth::get_user_context(&req);

    if !acl::can_write_channel(&user_context.role, None) {
        return HttpResponse::Unauthorized().json(serde_json::json!({
            "error": "Insufficient permissions to delete channels"
        }));
    }

    let (app_name, channel_name) = path.into_inner();
    let db = db.get_ref();

    let app_model = match app::Entity::find()
        .filter(app::Column::Name.eq(&app_name))
        .one(db)
        .await
    {
        Ok(Some(app)) => app,
        Ok(None) => {
            return HttpResponse::NotFound().json(serde_json::json!({
                "error": "App not found"
            }));
        }
        Err(e) => {
            println!("Database error while finding app: {}", e);
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Database error"
            }));
        }
    };

    match channel::Entity::find()
        .filter(channel::Column::AppId.eq(app_model.id))
        .filter(channel::Column::Name.eq(&channel_name))
        .one(db)
        .await
    {
        Ok(Some(channel_model)) => {
            match channel::Entity::delete_by_id(channel_model.id)
                .exec(db)
                .await
            {
                Ok(_) => HttpResponse::Ok().json(serde_json::json!({
                    "message": "Channel deleted successfully"
                })),
                Err(e) => {
                    println!("Database error while deleting channel: {}", e);
                    HttpResponse::InternalServerError().json(serde_json::json!({
                        "error": "Failed to delete channel"
                    }))
                }
            }
        }
        Ok(None) => HttpResponse::NotFound().json(serde_json::json!({
            "error": "Channel not found"
        })),
        Err(e) => {
            println!("Database error while finding channel: {}", e);
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Database error"
            }))
        }
    }
}

async fn list_deployments_with_acl(
    query: web::Query<DeploymentsQuery>,
    req: actix_web::HttpRequest,
    db: web::Data<sea_orm::DatabaseConnection>,
) -> impl Responder {
    let user_context = auth::get_user_context(&req);
    if !acl::can_read_deployment(&user_context.role, None) {
        return HttpResponse::Unauthorized().json(serde_json::json!({
            "error": "Insufficient permissions to read deployments"
        }));
    }

    let db = db.get_ref();
    let mut deployments_query =
        deployment::Entity::find().order_by_desc(deployment::Column::CreatedAt);

    if let Some(ref app_name) = query.app_name {
        deployments_query = deployments_query
            .join(JoinType::InnerJoin, deployment::Relation::App.def())
            .filter(entity::app::Column::Name.eq(app_name));

        if let Some(ref channel_name) = query.channel_name {
            deployments_query = deployments_query
                .join(JoinType::InnerJoin, deployment::Relation::Channel.def())
                .filter(channel::Column::Name.eq(channel_name));
        }
    }

    match deployments_query.all(db).await {
        Ok(deployments) => HttpResponse::Ok().json(deployments),
        Err(e) => {
            println!("Database error while fetching deployments: {}", e);
            HttpResponse::InternalServerError().json(serde_json::json!({ "error": "db error" }))
        }
    }
}

async fn delete_deployment(
    path: web::Path<String>,
    req: actix_web::HttpRequest,
    db: web::Data<sea_orm::DatabaseConnection>,
) -> impl Responder {
    let user_context = auth::get_user_context(&req);

    if !acl::can_write_deployment(&user_context.role, None) {
        return HttpResponse::Unauthorized().json(serde_json::json!({
            "error": "Insufficient permissions to make deployments unavailable"
        }));
    }

    let deployment_id = path.into_inner();
    let clean_id = deployment_id
        .strip_prefix("version-")
        .unwrap_or(&deployment_id);
    let db = db.get_ref();

    match deployment::Entity::find()
        .filter(deployment::Column::Id.eq(clean_id))
        .one(db)
        .await
    {
        Ok(Some(deployment_model)) => {
            let mut deployment_update: deployment::ActiveModel = deployment_model.into();
            deployment_update.is_available = Set(false);

            match deployment_update.update(db).await {
                Ok(_) => HttpResponse::Ok().json(serde_json::json!({
                    "message": "Deployment marked as unavailable"
                })),
                Err(e) => {
                    println!("Database error while updating deployment: {}", e);
                    HttpResponse::InternalServerError().json(serde_json::json!({
                        "error": "Failed to make deployment unavailable"
                    }))
                }
            }
        }
        Ok(None) => HttpResponse::NotFound().json(serde_json::json!({
            "error": "Deployment not found"
        })),
        Err(e) => {
            println!("Database error while finding deployment: {}", e);
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Database error"
            }))
        }
    }
}

pub async fn get_user_info(req: actix_web::HttpRequest) -> impl Responder {
    let user_context = auth::get_user_context(&req);

    HttpResponse::Ok().json(serde_json::json!({
        "role": user_context.role,
        "is_override": user_context.is_override
    }))
}

pub async fn list_api_keys(
    req: actix_web::HttpRequest,
    db_conn: web::Data<sea_orm::DatabaseConnection>,
) -> impl Responder {
    let user_context = auth::get_user_context(&req);

    if !user_context.is_override && user_context.role != "admin" {
        return HttpResponse::Forbidden().json(serde_json::json!({
            "error": "Admin access required"
        }));
    }

    match entity::api_key::Entity::find().all(db_conn.get_ref()).await {
        Ok(api_keys) => {
            let api_keys_response: Vec<serde_json::Value> = api_keys
                .into_iter()
                .map(|key| {
                    serde_json::json!({
                        "id": key.id,
                        "key": "***hidden***",
                        "role": key.role,
                        "active": key.active,
                        "created_at": key.created_at.format("%Y-%m-%d %H:%M:%S").to_string()
                    })
                })
                .collect();

            HttpResponse::Ok().json(api_keys_response)
        }
        Err(e) => {
            println!("Database error while fetching API keys: {}", e);
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to fetch API keys"
            }))
        }
    }
}

pub async fn create_api_key(
    req: actix_web::HttpRequest,
    body: web::Json<serde_json::Value>,
    db_conn: web::Data<sea_orm::DatabaseConnection>,
) -> impl Responder {
    let user_context = auth::get_user_context(&req);

    if !user_context.is_override && user_context.role != "admin" {
        return HttpResponse::Forbidden().json(serde_json::json!({
            "error": "Admin access required"
        }));
    }

    let role = match body.get("role").and_then(|r| r.as_str()) {
        Some(role) => role.to_string(),
        None => {
            return HttpResponse::BadRequest().json(serde_json::json!({
                "error": "Role is required"
            }));
        }
    };

    if !["admin", "guest", "readonly", "readwrite"].contains(&role.as_str()) {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "error": "Invalid role. Must be: admin, guest, readonly, or readwrite"
        }));
    }

    let new_key = uuid::Uuid::new_v4().to_string();
    let hashed_key = auth::hash_api_key(&new_key);
    let key_id = uuid::Uuid::new_v4();

    let new_api_key = entity::api_key::ActiveModel {
        id: sea_orm::ActiveValue::Set(key_id),
        key: sea_orm::ActiveValue::Set(hashed_key),
        role: sea_orm::ActiveValue::Set(role.clone()),
        active: sea_orm::ActiveValue::Set(true),
        created_at: sea_orm::ActiveValue::Set(chrono::Utc::now().naive_utc()),
    };

    match entity::api_key::Entity::insert(new_api_key)
        .exec(db_conn.get_ref())
        .await
    {
        Ok(_) => HttpResponse::Created().json(serde_json::json!({
            "id": key_id,
            "key": new_key,
            "role": role
        })),
        Err(e) => {
            println!("Database error while creating API key: {}", e);
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to create API key"
            }))
        }
    }
}

pub async fn delete_api_key(
    path: web::Path<String>,
    req: actix_web::HttpRequest,
    db: web::Data<sea_orm::DatabaseConnection>,
) -> impl Responder {
    let user_context = auth::get_user_context(&req);

    if !user_context.is_override && user_context.role != "admin" {
        return HttpResponse::Forbidden().json(serde_json::json!({
            "error": "Admin access required"
        }));
    }

    let api_key_id = path.into_inner();
    let db = db.get_ref();

    let key_uuid = match uuid::Uuid::parse_str(&api_key_id) {
        Ok(uuid) => uuid,
        Err(_) => {
            return HttpResponse::BadRequest().json(serde_json::json!({
                "error": "Invalid API key ID format"
            }));
        }
    };

    match entity::api_key::Entity::delete_by_id(key_uuid)
        .exec(db)
        .await
    {
        Ok(_) => HttpResponse::Ok().json(serde_json::json!({
            "message": "API key deleted successfully"
        })),
        Err(e) => {
            println!("Database error while deleting API key: {}", e);
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to delete API key"
            }))
        }
    }
}

pub async fn toggle_api_key(
    path: web::Path<String>,
    req: actix_web::HttpRequest,
    db: web::Data<sea_orm::DatabaseConnection>,
) -> impl Responder {
    let user_context = auth::get_user_context(&req);

    if !user_context.is_override && user_context.role != "admin" {
        return HttpResponse::Forbidden().json(serde_json::json!({
            "error": "Admin access required"
        }));
    }

    let api_key_id = path.into_inner();
    let db = db.get_ref();

    let key_uuid = match uuid::Uuid::parse_str(&api_key_id) {
        Ok(uuid) => uuid,
        Err(_) => {
            return HttpResponse::BadRequest().json(serde_json::json!({
                "error": "Invalid API key ID format"
            }));
        }
    };

    match entity::api_key::Entity::find_by_id(key_uuid).one(db).await {
        Ok(Some(api_key)) => {
            let mut api_key_update: entity::api_key::ActiveModel = api_key.into();
            api_key_update.active = sea_orm::ActiveValue::Set(!api_key_update.active.unwrap());

            match api_key_update.update(db).await {
                Ok(updated_key) => HttpResponse::Ok().json(serde_json::json!({
                    "message": "API key status toggled successfully",
                    "active": updated_key.active
                })),
                Err(e) => {
                    println!("Database error while updating API key: {}", e);
                    HttpResponse::InternalServerError().json(serde_json::json!({
                        "error": "Failed to toggle API key status"
                    }))
                }
            }
        }
        Ok(None) => HttpResponse::NotFound().json(serde_json::json!({
            "error": "API key not found"
        })),
        Err(e) => {
            println!("Database error while finding API key: {}", e);
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Database error"
            }))
        }
    }
}

pub fn configure_routes(cfg: &mut web::ServiceConfig) {
    cfg.service(web::resource("/").route(web::get().to(health_check)))
        .service(web::resource("/info").route(web::get().to(info)))
        .service(web::resource("/DeployHistory.txt").route(web::get().to(deployhistory)))
        .service(
            web::scope("/api")
                .wrap(auth::Auth)
                .service(web::resource("/user").route(web::get().to(get_user_info)))
                .service(web::resource("/my/permissions").route(web::get().to(my_permissions)))
                .service(web::resource("/download").route(web::get().to(get_download_url)))
                .service(web::resource("/deployments").route(web::get().to(get_deployments)))
                .service(web::resource("/latest-version").route(web::get().to(get_latest_version)))
                .service(web::resource("/apps").route(web::get().to(list_apps_json)))
                .service(
                    web::resource("/channels").route(web::get().to(list_channels_for_app_json)),
                )
                .service(web::resource("/upload").route(web::post().to(upload_stage1)))
                .service(web::resource("/upload/report").route(web::post().to(upload_stage2)))
                .service(
                    web::scope("/admin")
                        .service(
                            web::resource("/api-keys")
                                .route(web::get().to(list_api_keys))
                                .route(web::post().to(create_api_key)),
                        )
                        .service(
                            web::resource("/api-keys/{id}").route(web::delete().to(delete_api_key)),
                        )
                        .service(
                            web::resource("/api-keys/{id}/toggle")
                                .route(web::put().to(toggle_api_key)),
                        )
                        .service(web::resource("/apps").route(web::post().to(create_app)))
                        .service(
                            web::resource("/apps/{app_name}").route(web::delete().to(delete_app)),
                        )
                        .service(web::resource("/channels").route(web::post().to(create_channel)))
                        .service(
                            web::resource("/channels/{app_name}/{channel_name}")
                                .route(web::delete().to(delete_channel)),
                        )
                        .service(
                            web::resource("/deployments")
                                .route(web::get().to(list_deployments_with_acl)),
                        )
                        .service(
                            web::resource("/deployments/{deployment_id}")
                                .route(web::delete().to(delete_deployment)),
                        ),
                ),
        )
        .service(web::resource("/admin").route(web::get().to(admin_ui::redirect_to_admin)))
        .service(web::resource("/admin/").route(web::get().to(admin_ui::serve_admin_ui)))
        .service(
            web::resource("/admin/{filename:.*}").route(web::get().to(admin_ui::serve_admin_ui)),
        );
}
