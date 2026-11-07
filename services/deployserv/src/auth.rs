use actix_web::{
    Error, HttpMessage,
    body::{BoxBody, EitherBody, MessageBody},
    dev::{Service, ServiceRequest, ServiceResponse, Transform},
    web,
};
use futures_util::future::{LocalBoxFuture, Ready, ready};
use sea_orm::{ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter};
use sha2::{Digest, Sha256};
use std::task::{Context, Poll};

pub fn hash_api_key(api_key: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(api_key.as_bytes());
    hex::encode(hasher.finalize())
}

#[derive(Debug, Clone)]
pub struct UserContext {
    pub role: String,
    pub is_override: bool,
}

impl UserContext {
    pub fn new(role: String, is_override: bool) -> Self {
        Self { role, is_override }
    }

    pub fn guest() -> Self {
        Self {
            role: "guest".to_string(),
            is_override: false,
        }
    }
}

pub struct Auth;

impl<S, B> Transform<S, ServiceRequest> for Auth
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    S::Future: 'static,
    B: MessageBody + 'static,
{
    type Response = ServiceResponse<EitherBody<B, BoxBody>>;
    type Error = Error;
    type InitError = ();
    type Transform = AuthMiddleware<S>;
    type Future = Ready<Result<Self::Transform, Self::InitError>>;

    fn new_transform(&self, service: S) -> Self::Future {
        ready(Ok(AuthMiddleware {
            service: Rc::new(service),
        }))
    }
}

use std::rc::Rc;

pub struct AuthMiddleware<S> {
    service: Rc<S>,
}

impl<S, B> Service<ServiceRequest> for AuthMiddleware<S>
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    S::Future: 'static,
    B: MessageBody + 'static,
{
    type Response = ServiceResponse<EitherBody<B, BoxBody>>;
    type Error = Error;
    type Future = LocalBoxFuture<'static, Result<Self::Response, Self::Error>>;

    fn poll_ready(&self, cx: &mut Context<'_>) -> Poll<Result<(), Self::Error>> {
        self.service.poll_ready(cx)
    }

    fn call(&self, req: ServiceRequest) -> Self::Future {
        let api_key = req
            .headers()
            .get("X-Api-Key")
            .or_else(|| req.headers().get("AccessKey"))
            .and_then(|h| h.to_str().ok())
            .map(|s| s.to_string());
        if let Some(ref key) = api_key {
            req.extensions_mut().insert(ApiKeyRaw(key.clone()));
        }

        let override_key = crate::cfg::get_config().server.override_key.clone();
        if let (Some(ovk), Some(provided)) = (override_key.as_ref(), api_key.as_ref()) {
            if provided == ovk {
                req.extensions_mut()
                    .insert(UserContext::new("admin".to_string(), true));
                let srv = self.service.clone();
                return Box::pin(async move {
                    let res = srv.call(req).await?;
                    Ok(res.map_into_left_body())
                });
            }
        }

        let db = req.app_data::<web::Data<DatabaseConnection>>().cloned();
        let srv = self.service.clone();
        Box::pin(async move {
            let role = if let (Some(k), Some(db_conn)) = (api_key, db) {
                match resolve_api_key_role(&k, db_conn.get_ref()).await {
                    Ok(Some(r)) => r,
                    _ => "guest".to_string(),
                }
            } else {
                "guest".to_string()
            };
            req.extensions_mut().insert(UserContext::new(role, false));
            let res = srv.call(req).await?;
            Ok(res.map_into_left_body())
        })
    }
}

#[derive(Debug, Clone)]
pub struct ApiKeyRaw(pub String);

pub async fn resolve_api_key_role(
    api_key: &str,
    db: &DatabaseConnection,
) -> Result<Option<String>, sea_orm::DbErr> {
    let hashed_key = hash_api_key(api_key);
    let api_key_record = entity::api_key::Entity::find()
        .filter(entity::api_key::Column::Key.eq(hashed_key))
        .filter(entity::api_key::Column::Active.eq(true))
        .one(db)
        .await?;

    Ok(api_key_record.map(|record| record.role))
}

pub fn get_user_context(req: &actix_web::HttpRequest) -> UserContext {
    req.extensions()
        .get::<UserContext>()
        .cloned()
        .unwrap_or_else(UserContext::guest)
}

pub fn get_api_key(req: &actix_web::HttpRequest) -> Option<String> {
    req.extensions().get::<ApiKeyRaw>().map(|raw| raw.0.clone())
}
