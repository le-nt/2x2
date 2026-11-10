use crate::ArbiterError;
use once_cell::sync::OnceCell;
use resources::LuaArg;
use std::path::PathBuf;

pub fn build_args(args: Vec<LuaArg>) -> Vec<bsoap::LuaValue> {
    args.into_iter()
        .map(|arg| match arg {
            LuaArg::String(s) => bsoap::LuaValue {
                valuetype: "LUA_TSTRING".to_string(),
                value: Some(s),
                table: None,
            },
            LuaArg::Number(n) => bsoap::LuaValue {
                valuetype: "LUA_TNUMBER".to_string(),
                value: Some(n.to_string()),
                table: None,
            },
            LuaArg::Float(f) => bsoap::LuaValue {
                valuetype: "LUA_TNUMBER".to_string(),
                value: Some(f.to_string()),
                table: None,
            },
            LuaArg::Boolean(b) => bsoap::LuaValue {
                valuetype: "LUA_TBOOLEAN".to_string(),
                value: Some(b.to_string().to_lowercase()),
                table: None,
            },
            LuaArg::Nil => bsoap::LuaValue {
                valuetype: "LUA_TNIL".to_string(),
                value: Some("nil".to_string()),
                table: None,
            },
        })
        .collect()
}

static RCC_PATH: OnceCell<PathBuf> = OnceCell::new();

pub fn set_rcc_path(path: &str) -> Result<(), ArbiterError> {
    if path.trim().is_empty() {
        return Err(ArbiterError::RccServiceError("Empty RCC path".into()));
    }
    let p = PathBuf::from(path);
    if !p.exists() {
        return Err(ArbiterError::RccServiceStartError(format!(
            "RCCService not found at {}",
            p.display()
        )));
    }
    RCC_PATH
        .set(p)
        .map_err(|_| ArbiterError::RccServiceError("RCC path already set".into()))?;
    Ok(())
}

pub fn get_rcc_path() -> Option<&'static PathBuf> {
    RCC_PATH.get()
}

#[derive(Debug)]
#[allow(dead_code)]
pub enum SuccessType {
    WithResult(String),
    NoResult,
}

#[derive(Debug)]
#[allow(dead_code)]
pub enum SoapResult {
    Success(SuccessType),
    InternalServerError,
    ConnectionError,
    BadRequest,
}

// SOAP client has been moved to the `bsoap` crate.

pub mod util {
    use crate::{ArbiterError, cfg, rcc};
    use crate::{cfg::STORE, responses::SizeObject};
    use bsoap::{EnvelopeResponse, SoapResponseBody, SoapResult, SuccessType};
    use reqwest::Client;
    use resources::{self, LuaArg, image::ImageFormat, thumb::ThumbnailType};
    use serde_json::json;
    use std::{env, path::PathBuf};
    use tokio::{
        process::{Child, Command},
        time::{Duration, sleep},
    };
    use uuid::Uuid;

    async fn start_rcc_instance(
        base_url: &str,
        access_key: &str,
    ) -> Result<(Child, i32, crate::ports::PortLease), ArbiterError> {
        let rcc_path = tokio::task::spawn_blocking(|| {
            // Prefer explicit RCC path if set via CLI, otherwise fall back to ./RobloxRCC/RCCService
            if let Some(p) = rcc::get_rcc_path() {
                p.clone()
            } else {
                let mut path = env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
                path.push("RobloxRCC");
                path.push("RCCService");
                path
            }
        })
        .await
        .map_err(|e| ArbiterError::RccServiceStartError(e.to_string()))?;

        if !rcc_path.exists() {
            return Err(ArbiterError::RccServiceStartError(format!(
                "RCCService not found at {}",
                rcc_path.display()
            )));
        }

        let rcc_dir_absolute_path = tokio::task::spawn_blocking(move || rcc_path.canonicalize())
            .await
            .map_err(|e| ArbiterError::RccServiceStartError(e.to_string()))?
            .map_err(|e| ArbiterError::RccServiceStartError(e.to_string()))?;

        let rcc_binary_path = rcc_dir_absolute_path
            .to_str()
            .ok_or_else(|| ArbiterError::RccServiceStartError("Invalid RCCService path".into()))?
            .to_owned();

        let rcc_working_dir = rcc_dir_absolute_path.parent().ok_or_else(|| {
            ArbiterError::RccServiceStartError(
                "Could not get parent directory of RCCService".into(),
            )
        })?;

        let mut soap_lease = cfg::get_usable_port_soap()?;
        let soap_port = soap_lease.port();
        soap_lease.release_bind();

        let mut child = Command::new(&rcc_binary_path)
            .kill_on_drop(true)
            .current_dir(rcc_working_dir)
            .arg(format!("-BaseUrl:{}", base_url))
            .arg("-Port")
            .arg(soap_port.to_string())
            .env("RBX_ACCESS_KEY", access_key)
            .env("RBX_SECRET_KEY", cfg::get_config().expect("Arbiter config initialized").signing_key.clone())
            .env("RBX_INTERNAL_BASE_URL", base_url)
            .env("EGL_PLATFORM", "surfaceless")
            .spawn()
            .map_err(|e| ArbiterError::RccServiceStartError(e.to_string()))?;

        const MAX_ATTEMPTS: usize = 20;
        for attempt in 0..MAX_ATTEMPTS {
            log::info!(
                "Attempt {} to connect to RCCService:{}",
                attempt + 1,
                soap_port
            );
            match bsoap::client::HelloWorld(soap_port).await {
                SoapResult::Success(_) => {
                    log::info!("RCCService:{} connected", soap_port);
                    return Ok((child, soap_port, soap_lease));
                }
                SoapResult::InternalServerError | SoapResult::BadRequest => {
                    break;
                }
                SoapResult::ConnectionError => sleep(Duration::from_millis(500)).await,
            }
        }

        let _ = child.kill().await;
        Err(ArbiterError::RccServiceStartError(
            "RCCService did not start in time or failed".into(),
        ))
    }

    pub async fn new_gameserver(place_id: i32) -> Result<String, ArbiterError> {
        let job_id = Uuid::new_v4().to_string();

        let script_content = resources::get_gameserver_script().to_string();

        let config = cfg::get_config().expect("Failed to get config");
        let mut network_lease = cfg::get_usable_port_game()?;
        let ns_port = network_lease.port();

        let args = rcc::build_args(vec![
            resources::LuaArg::Number(place_id),
            resources::LuaArg::Number(ns_port),
            resources::LuaArg::String(config.base_url.to_string()),
        ]);

        let (mut child, soap_port, _soap_lease) =
            match start_rcc_instance(&config.base_url, &config.access_key).await {
                Ok(instance) => instance,
                Err(e) => {
                    return Err(e);
                }
            };

        network_lease.release_bind();
        let result = bsoap::client::OpenJobEx(
            soap_port,
            job_id.clone(),
            script_content,
            Some(args),
            120, // The Job will expire in 120 seconds, but we renew via Heartbeat pretty often.
        )
        .await;

        match result {
            SoapResult::Success(_) => {
                // Move the RCC child process into the global STORE so we can manage its lifecycle later.
                STORE
                    .get()
                    .expect("STORE should be initialized")
                    .lock()
                    .expect("Failed to lock STORE")
                    .insert(job_id.clone(), (ns_port, soap_port, child));
                Ok(job_id)
            }
            SoapResult::InternalServerError => {
                let _ = child.kill().await;
                Err(ArbiterError::RccServiceError(
                    "Internal Server Error".into(),
                ))
            }
            SoapResult::ConnectionError => {
                let _ = child.kill().await;
                Err(ArbiterError::RccServiceError("Connection Error".into()))
            }
            SoapResult::BadRequest => {
                let _ = child.kill().await;
                Err(ArbiterError::RccServiceError("Bad Request".into()))
            }
        }
    }

    async fn dispatch_avatar(
        soap_result: SoapResult,
        size: SizeObject,
        bust: bool,
        dispatch_url: String,
        access_key: String,
        hash: String,
    ) -> Result<(), ArbiterError> {
        let xml_string = match soap_result {
            SoapResult::Success(SuccessType::WithResult(s)) => s,
            SoapResult::Success(SuccessType::NoResult) => {
                return Err(ArbiterError::RccServiceError(
                    "Expected a result from BatchJobEx, but got none.".into(),
                ));
            }
            SoapResult::InternalServerError => {
                return Err(ArbiterError::RccServiceError(
                    "Internal Server Error".into(),
                ));
            }
            SoapResult::ConnectionError => {
                return Err(ArbiterError::RccServiceError("Connection Error".into()));
            }
            SoapResult::BadRequest => {
                return Err(ArbiterError::RccServiceError("Bad Request".into()));
            }
        };

        let envelope =
            yaserde::de::from_str::<EnvelopeResponse>(xml_string.trim()).map_err(|e| {
                log::error!("Failed to deserialize response: {}", e);
                log::error!("Response was: {}", xml_string);
                ArbiterError::RccServiceError("Failed to parse XML response".into())
            })?;

        let render = if let SoapResponseBody::BatchJobExResponse(response) = envelope.body {
            if let Some(lua_values) = response.result {
                if let Some(first_value) = lua_values.lua_values.first() {
                    if first_value.valuetype == "LUA_TSTRING" {
                        Some(first_value.value.clone().unwrap_or_default())
                    } else {
                        None
                    }
                } else {
                    None
                }
            } else {
                None
            }
        } else {
            None
        };

        if let Some(render) = render {
            let client = Client::builder()
                .user_agent("Roblox/1.0")
                .build()
                .expect("Failed to build HTTP client");
            let response = client
                .post(&dispatch_url)
                .json(&json!({
                    "success": true,
                    "hash": hash,
                    "bust": bust,
                    "render": render,
                    "height": size.height,
                    "width": size.width,
                }))
                .header("AccessKey", access_key)
                .send()
                .await;

            match response {
                Ok(r) if r.status().is_success() => {
                    log::info!(
                        "Render dispatched successfully for size {}x{} and bust {}",
                        size.width,
                        size.height,
                        bust
                    );
                }
                Ok(r) => {
                    log::error!("Failed to dispatch render: {}", r.status());
                }
                Err(e) => {
                    log::error!("Error dispatching render: {:?}", e);
                }
            }
        } else {
            log::warn!(
                "skipping size {}x{}: could not extract render",
                size.width,
                size.height
            );
            return Err(ArbiterError::RccServiceError(
                "Could not extract render from SOAP response.".into(),
            ));
        }

        Ok(())
    }

    async fn dispatch_asset(
        soap_result: SoapResult,
        size: SizeObject,
        dispatch_url: String,
        access_key: String,
        global_version_id: i32,
    ) -> Result<(), ArbiterError> {
        let xml_string = match soap_result {
            SoapResult::Success(SuccessType::WithResult(s)) => s,
            SoapResult::Success(SuccessType::NoResult) => {
                return Err(ArbiterError::RccServiceError(
                    "Expected a result from BatchJobEx, but got none.".into(),
                ));
            }
            SoapResult::InternalServerError => {
                return Err(ArbiterError::RccServiceError(
                    "Internal Server Error".into(),
                ));
            }
            SoapResult::ConnectionError => {
                return Err(ArbiterError::RccServiceError("Connection Error".into()));
            }
            SoapResult::BadRequest => {
                return Err(ArbiterError::RccServiceError("Bad Request".into()));
            }
        };

        let envelope =
            yaserde::de::from_str::<EnvelopeResponse>(xml_string.trim()).map_err(|e| {
                log::error!("Failed to deserialize response: {}", e);
                log::error!("Response was: {}", xml_string);
                ArbiterError::RccServiceError("Failed to parse XML response".into())
            })?;

        let render = if let SoapResponseBody::BatchJobExResponse(response) = envelope.body {
            if let Some(lua_values) = response.result {
                if let Some(first_value) = lua_values.lua_values.first() {
                    if first_value.valuetype == "LUA_TSTRING" {
                        Some(first_value.value.clone().unwrap_or_default())
                    } else {
                        None
                    }
                } else {
                    None
                }
            } else {
                None
            }
        } else {
            None
        };

        if let Some(render) = render {
            let client = Client::builder()
                .user_agent("Roblox/1.0")
                .build()
                .expect("Failed to build HTTP client");
            let response = client
                .post(&dispatch_url)
                .json(&json!({
                    "success": true,
                    "globalVersionId": global_version_id,
                    "render": render,
                    "height": size.height,
                    "width": size.width,
                }))
                .header("AccessKey", access_key)
                .send()
                .await;

            match response {
                Ok(r) if r.status().is_success() => {
                    log::info!(
                        "Asset render dispatched successfully for globalVersionId {} and size {}x{}",
                        global_version_id,
                        size.width,
                        size.height
                    );
                }
                Ok(r) => {
                    log::error!("Failed to dispatch asset render: {}", r.status());
                }
                Err(e) => {
                    log::error!("Error dispatching asset render: {:?}", e);
                }
            }
        } else {
            log::warn!(
                "skipping globalVersionId {}, size {}x{}: could not extract render",
                global_version_id,
                size.width,
                size.height
            );
            return Err(ArbiterError::RccServiceError(
                "Could not extract render from SOAP response.".into(),
            ));
        }

        Ok(())
    }

    async fn dispatch_validation(
        soap_result: SoapResult,
        id: i32,
        dispatch_url: String,
    ) -> Result<(), ArbiterError> {
        let status = match soap_result {
            SoapResult::Success(SuccessType::WithResult(s)) => {
                // parse true/false
                s.trim().eq_ignore_ascii_case("true")
            }
            SoapResult::Success(SuccessType::NoResult) => false,
            SoapResult::InternalServerError
            | SoapResult::ConnectionError
            | SoapResult::BadRequest => {
                return Err(ArbiterError::RccServiceError(
                    "Validation check due to internal error".into(),
                ));
            }
        };

        let client = Client::builder()
            .user_agent("Roblox/1.0")
            .build()
            .expect("Failed to build HTTP client");

        let response = client
            .post(&dispatch_url)
            .json(&json!({
                "id": id,
                "status": status
            }))
            .send()
            .await;

        match response {
            Ok(r) if r.status().is_success() => {
                log::info!(
                    "Validation dispatched successfully for id {} with status {}",
                    id,
                    status
                );
            }
            Ok(r) => {
                log::error!(
                    "Failed to dispatch validation for id {}: {}",
                    id,
                    r.status()
                );
            }
            Err(e) => {
                log::error!(
                    "Error dispatching validation for id {}: {:?}",
                    id,
                    e
                );
            }
        }

        Ok(())
    }

    pub async fn do_avatar_batch(
        user_id: i32,
        img_format: ImageFormat,
        hash: String,
        bust: bool,
        sizes: Vec<SizeObject>,
    ) -> Result<(), ArbiterError> {
        let config = cfg::get_config().expect("Failed to get config");
        let (mut child, soap_port, _soap_lease) =
            start_rcc_instance(&config.base_url, &config.access_key).await?;
        let config_ref = &config;

        for size in sizes {
            let thumbnail_type = if bust {
                resources::thumb::ThumbnailType::AvatarHeadShot
            } else {
                resources::thumb::ThumbnailType::Avatar
            };

            let charapp_url = format!(
                "{}/asset/characterappearance?userId={}",
                &config_ref.base_url, user_id
            );

            let other_args = if bust {
                vec![
                    LuaArg::String(config_ref.base_url.clone()),
                    LuaArg::String(charapp_url),
                    LuaArg::Boolean(true),
                    LuaArg::Number(30),
                    LuaArg::Number(100),
                    LuaArg::Number(0),
                    LuaArg::Number(0),
                ]
            } else {
                vec![
                    LuaArg::String(charapp_url),
                    LuaArg::String(config_ref.base_url.clone()),
                ]
            };

            let args = resources::get_script_args(
                thumbnail_type.clone(),
                img_format.clone(),
                size.width,
                size.height,
                other_args,
            );

            let script = resources::thumb::get_script_by_thumbnail_type(thumbnail_type).to_string();
            let job_id = Uuid::new_v4().to_string();

            // * Run the job
            let result = bsoap::client::BatchJobEx(
                soap_port,
                job_id.clone(),
                script,
                Some(rcc::build_args(args)),
                90,
            )
            .await;
            let _ = bsoap::client::CloseJob(soap_port, job_id).await;

            // * Dispatch the render result
            let dispatch_url = format!(
                "{}/internal/gameserver/upload/avatar-render",
                config_ref.base_url
            );
            let access_key = config_ref.access_key.clone();
            log::info!(
                "Dispatching avatar render for UserID {}, size {}x{} and bust {}",
                user_id,
                size.width,
                size.height,
                bust
            );
            let _ =
                dispatch_avatar(result, size, bust, dispatch_url, access_key, hash.clone()).await;
        }

        log::warn!("Killing PID {}", child.id().unwrap_or_default());
        let _ = child.kill().await;

        Ok(())
    }

    pub async fn validate_asset(asset_id: i32) -> Result<(), ArbiterError> {
        let lua_script = resources::get_validation_script();
        let config = cfg::get_config().expect("Failed to get config");
        let job_id = Uuid::new_v4().to_string();
        
        let args = rcc::build_args(vec![
            resources::LuaArg::Number(asset_id),
            resources::LuaArg::String(config.base_url.to_string()),
        ]);

        let (mut child, soap_port, _soap_lease) = rcc::util::start_rcc_instance(&config.base_url, &config.access_key).await?;
        let result = bsoap::client::BatchJobEx(
            soap_port,
            job_id.clone(),
            lua_script.to_string(),
            Some(args),
            30,
        )
        .await;

        // we send the status to the website
        let dispatch_url = format!(
            "{}/internal/gameserver/submit-validation",
            config.base_url
        );
        let _ = dispatch_validation(result, asset_id, dispatch_url).await;
        let _ = bsoap::client::CloseJob(soap_port, job_id.clone()).await;

        // can get rid of this now
        log::warn!("Killing PID {}", child.id().unwrap_or_default());
        let _ = child.kill().await;
        Ok(())
    }

    pub async fn do_asset_batch(
        global_version_id: i32,
        asset_id: i32,
        img_format: ImageFormat,
        thumbnail_type: ThumbnailType,
        sizes: Vec<SizeObject>,
        mannequin_or_universe_id: Option<i32>,
    ) -> Result<(), ArbiterError> {
        if thumbnail_type == ThumbnailType::Avatar
            || thumbnail_type == ThumbnailType::AvatarHeadShot
        {
            return Err(ArbiterError::RccServiceError(
                "Invalid thumbnail type for asset batch".into(),
            ));
        }
        let lua_script = resources::thumb::get_script_by_thumbnail_type(thumbnail_type.clone());
        let config_ref = cfg::get_config().expect("Failed to get config");
        let (mut child, soap_port, _soap_lease) = rcc::util::start_rcc_instance(&config_ref.base_url, &config_ref.access_key).await?;

        for size in sizes {
            let mut args = resources::get_script_args(
                thumbnail_type.clone(),
                img_format,
                size.width,
                size.height,
                vec![
                    LuaArg::String(format!("{}/asset?id={}", config_ref.base_url, asset_id)),
                    LuaArg::String(config_ref.base_url.clone()),
                ],
            );
            if let Some(mannequin_or_universe_id) = mannequin_or_universe_id {
                args.push(LuaArg::Number(mannequin_or_universe_id));
            }

            // renderbeepboop
            let job_id = Uuid::new_v4().to_string();
            let result = bsoap::client::BatchJobEx(
                soap_port,
                job_id.clone(),
                lua_script.to_string(),
                Some(rcc::build_args(args)),
                180,
            )
            .await;

            let _ = bsoap::client::CloseJob(soap_port, job_id.clone()).await;

            let dispatch_url = format!(
                "{}/internal/gameserver/upload/asset-render",
                config_ref.base_url
            );
            let access_key = config_ref.access_key.clone();
            log::info!(
                "Dispatching asset render for AssetID {}, size {}x{}",
                asset_id,
                size.width,
                size.height
            );
            let _ = dispatch_asset(result, size, dispatch_url, access_key, global_version_id).await;
            let _ = bsoap::client::CloseJob(soap_port, job_id.clone()).await;
        }
        log::warn!("Killing PID {}", child.id().unwrap_or_default());
        let _ = child.kill().await;
        Ok(())
    }

    pub async fn renew_gs_lease(
        job_id: String,
        expiration_in_seconds: u32,
    ) -> Result<(), ArbiterError> {
        let soap_port_opt = {
            let store = STORE
                .get()
                .expect("STORE must be initialized")
                .lock()
                .unwrap();
            store.get(&job_id).map(|(_, soap_port, _)| *soap_port)
        };
        match soap_port_opt {
            Some(soap_port) => {
                let result =
                    bsoap::client::RenewLease(soap_port, job_id.clone(), expiration_in_seconds)
                        .await;
                match result {
                    SoapResult::Success(_) => Ok(()),
                    SoapResult::InternalServerError => Err(ArbiterError::RccServiceError(
                        "Internal Server Error".into(),
                    )),
                    SoapResult::ConnectionError => {
                        Err(ArbiterError::RccServiceError("Connection Error".into()))
                    }
                    SoapResult::BadRequest => {
                        Err(ArbiterError::RccServiceError("Bad Request".into()))
                    }
                }
            }
            None => Err(ArbiterError::RccServiceError("Job ID not found".into())),
        }
    }

    pub async fn report_gs_closed(job_id: String) -> Result<(), ArbiterError> {
        let removed = {
            let mut store = STORE
                .get()
                .expect("STORE must be initialized")
                .lock()
                .unwrap();
            store.remove(&job_id)
        };

        match removed {
            Some((_ns_port, soap_port, mut child)) => {
                let _ = bsoap::client::CloseJob(soap_port, job_id.clone()).await;
                let _ = child.kill().await;
                Ok(())
            }
            None => Err(ArbiterError::RccServiceError("Job ID not found".into())),
        }
    }
}
