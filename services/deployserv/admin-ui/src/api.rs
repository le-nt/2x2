use base64::engine::general_purpose::STANDARD as BASE64_ENGINE;
use base64::Engine;
use serde::{Deserialize, Serialize};
use sha1::{Digest, Sha1};

#[cfg(not(target_arch = "wasm32"))]
use std::{sync::mpsc, time::Duration};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiKey {
    pub id: String,
    pub key: String,
    pub role: String,
    pub active: bool,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct App {
    pub id: String,
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Channel {
    pub id: String,
    pub name: String,
    pub app_id: String,
    #[serde(default)]
    pub public: bool,
    #[serde(default)]
    pub default: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Deployment {
    pub id: String,
    pub filename: String,
    pub sha1: String,
    pub is_done: bool,
    pub is_available: bool,
    pub created_at: String,
    pub app_id: String,
    pub channel_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateAppRequestDto {
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateChannelRequestDto {
    pub name: String,
    pub app_name: String,
    pub public: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UploadStage1Response {
    pub id: String,
    pub filename: String,
    pub url: String,
    pub verify: String,
    pub expiry: u64,
    #[serde(rename = "reportTo")]
    pub report_to: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateApiKeyRequest {
    pub role: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateApiKeyResponse {
    pub id: String,
    pub key: String,
    pub role: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserInfo {
    pub role: String,
    pub is_override: bool,
    #[serde(default)]
    pub privileges: Vec<String>,
}

pub struct ApiClient {
    base_url: String,
    api_key: Option<String>,
}

#[cfg(target_arch = "wasm32")]
thread_local! {
    static REQ_COUNTER: std::cell::Cell<u64> = std::cell::Cell::new(0);
}

#[cfg(not(target_arch = "wasm32"))]
static REQ_COUNTER: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);

impl ApiClient {
    pub fn new(base_url: String) -> Self {
        Self {
            base_url,
            api_key: None,
        }
    }

    pub fn set_api_key(&mut self, api_key: String) {
        self.api_key = Some(api_key);
    }

    fn headers(&self) -> ehttp::Headers {
        let mut headers = ehttp::Headers::new(&[("Content-Type", "application/json")]);
        if let Some(ref api_key) = self.api_key {
            headers = ehttp::Headers::new(&[
                ("Content-Type", "application/json"),
                ("X-Api-Key", api_key),
            ]);
        }
        headers
    }

    pub async fn verify_api_key(&mut self, api_key: String) -> Result<UserInfo, String> {
        self.set_api_key(api_key);
        self.fetch_permissions().await
    }

    pub async fn fetch_permissions(&self) -> Result<UserInfo, String> {
        let request = {
            #[cfg(target_arch = "wasm32")]
            {
                ehttp::Request {
                    method: "GET".to_string(),
                    url: format!("{}/api/my/permissions", self.base_url),
                    body: vec![],
                    headers: self.headers(),
                    mode: ehttp::Mode::Cors,
                }
            }
            #[cfg(not(target_arch = "wasm32"))]
            {
                ehttp::Request {
                    method: "GET".to_string(),
                    url: format!("{}/api/my/permissions", self.base_url),
                    body: vec![],
                    headers: self.headers(),
                }
            }
        };
        self.send_request(request).await.and_then(|response| {
            if response.status == 200 {
                serde_json::from_slice::<UserInfo>(&response.bytes)
                    .map_err(|e| format!("Failed to parse permissions: {}", e))
            } else {
                Err(format!("Permission fetch failed: {}", response.status))
            }
        })
    }

    pub async fn get_api_keys(&self) -> Result<Vec<ApiKey>, String> {
        let request = {
            #[cfg(target_arch = "wasm32")]
            {
                ehttp::Request {
                    method: "GET".to_string(),
                    url: format!("{}/api/admin/api-keys", self.base_url),
                    body: vec![],
                    headers: self.headers(),
                    mode: ehttp::Mode::Cors,
                }
            }
            #[cfg(not(target_arch = "wasm32"))]
            {
                ehttp::Request {
                    method: "GET".to_string(),
                    url: format!("{}/api/admin/api-keys", self.base_url),
                    body: vec![],
                    headers: self.headers(),
                }
            }
        };

        self.send_request(request).await.and_then(|response| {
            if response.status == 200 {
                serde_json::from_slice::<Vec<ApiKey>>(&response.bytes)
                    .map_err(|e| format!("Failed to parse API keys: {}", e))
            } else {
                Err(format!("Failed to fetch API keys: {}", response.status))
            }
        })
    }

    pub async fn create_api_key(&self, role: &str) -> Result<CreateApiKeyResponse, String> {
        let create_request = CreateApiKeyRequest {
            role: role.to_string(),
        };

        let body = serde_json::to_vec(&create_request)
            .map_err(|e| format!("Serialization error: {}", e))?;

        let request = {
            #[cfg(target_arch = "wasm32")]
            {
                ehttp::Request {
                    method: "POST".to_string(),
                    url: format!("{}/api/admin/api-keys", self.base_url),
                    body,
                    headers: self.headers(),
                    mode: ehttp::Mode::Cors,
                }
            }
            #[cfg(not(target_arch = "wasm32"))]
            {
                ehttp::Request {
                    method: "POST".to_string(),
                    url: format!("{}/api/admin/api-keys", self.base_url),
                    body,
                    headers: self.headers(),
                }
            }
        };

        self.send_request(request).await.and_then(|response| {
            if response.status == 201 || response.status == 200 {
                serde_json::from_slice::<CreateApiKeyResponse>(&response.bytes)
                    .map_err(|e| format!("Failed to parse created API key: {}", e))
            } else {
                Err(format!("Failed to create API key: {}", response.status))
            }
        })
    }

    pub async fn delete_api_key(&self, id: &str) -> Result<(), String> {
        let request = {
            #[cfg(target_arch = "wasm32")]
            {
                ehttp::Request {
                    method: "DELETE".to_string(),
                    url: format!("{}/api/admin/api-keys/{}", self.base_url, id),
                    body: vec![],
                    headers: self.headers(),
                    mode: ehttp::Mode::Cors,
                }
            }
            #[cfg(not(target_arch = "wasm32"))]
            {
                ehttp::Request {
                    method: "DELETE".to_string(),
                    url: format!("{}/api/admin/api-keys/{}", self.base_url, id),
                    body: vec![],
                    headers: self.headers(),
                }
            }
        };

        self.send_request(request).await.and_then(|response| {
            if response.status == 200 || response.status == 204 {
                Ok(())
            } else {
                Err(format!("Failed to delete API key: {}", response.status))
            }
        })
    }

    pub async fn toggle_api_key(&self, id: &str) -> Result<(), String> {
        let request = {
            #[cfg(target_arch = "wasm32")]
            {
                ehttp::Request {
                    method: "PUT".to_string(),
                    url: format!("{}/api/admin/api-keys/{}/toggle", self.base_url, id),
                    body: vec![],
                    headers: self.headers(),
                    mode: ehttp::Mode::Cors,
                }
            }
            #[cfg(not(target_arch = "wasm32"))]
            {
                ehttp::Request {
                    method: "PUT".to_string(),
                    url: format!("{}/api/admin/api-keys/{}/toggle", self.base_url, id),
                    body: vec![],
                    headers: self.headers(),
                }
            }
        };

        self.send_request(request).await.and_then(|response| {
            if response.status == 200 {
                Ok(())
            } else {
                Err(format!("Failed to toggle API key: {}", response.status))
            }
        })
    }

    pub async fn get_apps(&self) -> Result<Vec<App>, String> {
        let request = {
            #[cfg(target_arch = "wasm32")]
            {
                ehttp::Request {
                    method: "GET".to_string(),
                    url: format!("{}/api/apps", self.base_url),
                    body: vec![],
                    headers: self.headers(),
                    mode: ehttp::Mode::Cors,
                }
            }
            #[cfg(not(target_arch = "wasm32"))]
            {
                ehttp::Request {
                    method: "GET".to_string(),
                    url: format!("{}/api/apps", self.base_url),
                    body: vec![],
                    headers: self.headers(),
                }
            }
        };

        self.send_request(request).await.and_then(|response| {
            if response.status == 200 {
                serde_json::from_slice::<Vec<App>>(&response.bytes)
                    .map_err(|e| format!("Failed to parse apps: {}", e))
            } else {
                Err(format!("Failed to fetch apps: {}", response.status))
            }
        })
    }

    pub async fn create_app(&self, name: &str) -> Result<(), String> {
        let payload = serde_json::to_vec(&CreateAppRequestDto {
            name: name.to_string(),
        })
        .map_err(|e| e.to_string())?;
        let request = {
            #[cfg(target_arch = "wasm32")]
            {
                ehttp::Request {
                    method: "POST".to_string(),
                    url: format!("{}/api/admin/apps", self.base_url),
                    body: payload,
                    headers: self.headers(),
                    mode: ehttp::Mode::Cors,
                }
            }
            #[cfg(not(target_arch = "wasm32"))]
            {
                ehttp::Request {
                    method: "POST".to_string(),
                    url: format!("{}/api/admin/apps", self.base_url),
                    body: payload,
                    headers: self.headers(),
                }
            }
        };
        let resp = self.send_request(request).await?;
        if resp.status == 201 {
            Ok(())
        } else {
            Err(format!("Create app failed: {}", resp.status))
        }
    }

    pub async fn delete_app(&self, name: &str) -> Result<(), String> {
        let request = {
            #[cfg(target_arch = "wasm32")]
            {
                ehttp::Request {
                    method: "DELETE".to_string(),
                    url: format!("{}/api/admin/apps/{}", self.base_url, name),
                    body: vec![],
                    headers: self.headers(),
                    mode: ehttp::Mode::Cors,
                }
            }
            #[cfg(not(target_arch = "wasm32"))]
            {
                ehttp::Request {
                    method: "DELETE".to_string(),
                    url: format!("{}/api/admin/apps/{}", self.base_url, name),
                    body: vec![],
                    headers: self.headers(),
                }
            }
        };
        let resp = self.send_request(request).await?;
        if resp.status == 200 {
            Ok(())
        } else {
            Err(format!("Delete app failed: {}", resp.status))
        }
    }

    pub async fn list_channels(&self, app_name: &str) -> Result<Vec<Channel>, String> {
        let url = format!(
            "{}/api/channels?app_name={}",
            self.base_url,
            urlencoding::encode(app_name)
        );
        let request = {
            #[cfg(target_arch = "wasm32")]
            {
                ehttp::Request {
                    method: "GET".to_string(),
                    url,
                    body: vec![],
                    headers: self.headers(),
                    mode: ehttp::Mode::Cors,
                }
            }
            #[cfg(not(target_arch = "wasm32"))]
            {
                ehttp::Request {
                    method: "GET".to_string(),
                    url,
                    body: vec![],
                    headers: self.headers(),
                }
            }
        };
        let resp = self.send_request(request).await?;
        if resp.status == 200 {
            serde_json::from_slice(&resp.bytes).map_err(|e| e.to_string())
        } else {
            Err(format!("List channels failed: {}", resp.status))
        }
    }

    pub async fn create_channel(
        &self,
        app_name: &str,
        name: &str,
        public: bool,
    ) -> Result<(), String> {
        let payload = serde_json::to_vec(&CreateChannelRequestDto {
            app_name: app_name.to_string(),
            name: name.to_string(),
            public,
        })
        .map_err(|e| e.to_string())?;
        let request = {
            #[cfg(target_arch = "wasm32")]
            {
                ehttp::Request {
                    method: "POST".to_string(),
                    url: format!("{}/api/admin/channels", self.base_url),
                    body: payload,
                    headers: self.headers(),
                    mode: ehttp::Mode::Cors,
                }
            }
            #[cfg(not(target_arch = "wasm32"))]
            {
                ehttp::Request {
                    method: "POST".to_string(),
                    url: format!("{}/api/admin/channels", self.base_url),
                    body: payload,
                    headers: self.headers(),
                }
            }
        };
        let resp = self.send_request(request).await?;
        if resp.status == 201 {
            Ok(())
        } else {
            Err(format!("Create channel failed: {}", resp.status))
        }
    }

    pub async fn delete_channel(&self, app_name: &str, channel_name: &str) -> Result<(), String> {
        let request = {
            #[cfg(target_arch = "wasm32")]
            {
                ehttp::Request {
                    method: "DELETE".to_string(),
                    url: format!(
                        "{}/api/admin/channels/{}/{}",
                        self.base_url, app_name, channel_name
                    ),
                    body: vec![],
                    headers: self.headers(),
                    mode: ehttp::Mode::Cors,
                }
            }
            #[cfg(not(target_arch = "wasm32"))]
            {
                ehttp::Request {
                    method: "DELETE".to_string(),
                    url: format!(
                        "{}/api/admin/channels/{}/{}",
                        self.base_url, app_name, channel_name
                    ),
                    body: vec![],
                    headers: self.headers(),
                }
            }
        };
        let resp = self.send_request(request).await?;
        if resp.status == 200 {
            Ok(())
        } else {
            Err(format!("Delete channel failed: {}", resp.status))
        }
    }

    pub async fn list_deployments(
        &self,
        app: Option<&str>,
        channel: Option<&str>,
    ) -> Result<Vec<Deployment>, String> {
        let mut url = format!("{}/api/admin/deployments", self.base_url);
        if app.is_some() {
            url.push_str(&format!("?app_name={}", urlencoding::encode(app.unwrap())));
            if let Some(ch) = channel {
                url.push_str(&format!("&channel_name={}", urlencoding::encode(ch)));
            }
        }
        let request = {
            #[cfg(target_arch = "wasm32")]
            {
                ehttp::Request {
                    method: "GET".to_string(),
                    url,
                    body: vec![],
                    headers: self.headers(),
                    mode: ehttp::Mode::Cors,
                }
            }
            #[cfg(not(target_arch = "wasm32"))]
            {
                ehttp::Request {
                    method: "GET".to_string(),
                    url,
                    body: vec![],
                    headers: self.headers(),
                }
            }
        };
        let resp = self.send_request(request).await?;
        if resp.status == 200 {
            serde_json::from_slice(&resp.bytes).map_err(|e| e.to_string())
        } else {
            Err(format!("List deployments failed: {}", resp.status))
        }
    }

    pub async fn delete_deployment(&self, deployment_id: &str) -> Result<(), String> {
        let request = {
            #[cfg(target_arch = "wasm32")]
            {
                ehttp::Request {
                    method: "DELETE".to_string(),
                    url: format!("{}/api/admin/deployments/{}", self.base_url, deployment_id),
                    body: vec![],
                    headers: self.headers(),
                    mode: ehttp::Mode::Cors,
                }
            }
            #[cfg(not(target_arch = "wasm32"))]
            {
                ehttp::Request {
                    method: "DELETE".to_string(),
                    url: format!("{}/api/admin/deployments/{}", self.base_url, deployment_id),
                    body: vec![],
                    headers: self.headers(),
                }
            }
        };
        let resp = self.send_request(request).await?;
        if resp.status == 200 {
            Ok(())
        } else {
            Err(format!("Delete deployment failed: {}", resp.status))
        }
    }

    pub async fn upload_stage1(
        &self,
        app_name: &str,
        channel_name: &str,
        sha1_b64: &str,
    ) -> Result<UploadStage1Response, String> {
        let mut base_pairs: Vec<(&str, &str)> = vec![("Content-Type", "application/json")];
        if let Some(ref api_key) = self.api_key {
            base_pairs.push(("X-Api-Key", api_key));
        }
        base_pairs.push(("X-App-Name", app_name));
        base_pairs.push(("X-Channel-Name", channel_name));
        base_pairs.push(("X-SHA1", sha1_b64));
        let headers = ehttp::Headers::new(&base_pairs);
        let request = {
            #[cfg(target_arch = "wasm32")]
            {
                ehttp::Request {
                    method: "POST".to_string(),
                    url: format!("{}/api/upload", self.base_url),
                    body: vec![],
                    headers,
                    mode: ehttp::Mode::Cors,
                }
            }
            #[cfg(not(target_arch = "wasm32"))]
            {
                ehttp::Request {
                    method: "POST".to_string(),
                    url: format!("{}/api/upload", self.base_url),
                    body: vec![],
                    headers,
                }
            }
        };
        let resp = self.send_request(request).await?;
        if resp.status == 200 {
            serde_json::from_slice(&resp.bytes).map_err(|e| e.to_string())
        } else {
            Err(format!("Upload stage1 failed: {}", resp.status))
        }
    }

    pub async fn upload_stage2_confirm(&self, deployment_id: &str) -> Result<(), String> {
        let mut base_pairs: Vec<(&str, &str)> = vec![("Content-Type", "application/json")];
        if let Some(ref api_key) = self.api_key {
            base_pairs.push(("X-Api-Key", api_key));
        }
        base_pairs.push(("X-Deployment-Id", deployment_id));
        let headers = ehttp::Headers::new(&base_pairs);
        let request = {
            #[cfg(target_arch = "wasm32")]
            {
                ehttp::Request {
                    method: "POST".to_string(),
                    url: format!("{}/api/upload/report", self.base_url),
                    body: vec![],
                    headers,
                    mode: ehttp::Mode::Cors,
                }
            }
            #[cfg(not(target_arch = "wasm32"))]
            {
                ehttp::Request {
                    method: "POST".to_string(),
                    url: format!("{}/api/upload/report", self.base_url),
                    body: vec![],
                    headers,
                }
            }
        };
        let resp = self.send_request(request).await?;
        if resp.status == 200 {
            Ok(())
        } else {
            Err(format!("Upload confirm failed: {}", resp.status))
        }
    }

    pub async fn upload_bundle(
        &self,
        app_name: &str,
        channel_name: &str,
        file_data: Vec<u8>,
        filename: &str,
    ) -> Result<String, String> {
        let mut hasher = Sha1::new();
        hasher.update(&file_data);
        let sha1_digest = hasher.finalize();
        let sha1_b64 = BASE64_ENGINE.encode(sha1_digest.as_slice());

        let stage1 = self
            .upload_stage1(app_name, channel_name, &sha1_b64)
            .await?;

        if stage1.verify != sha1_b64 {
            return Err("Checksum mismatch between client and server".to_string());
        }

        let content_type = "application/x-xz".to_string();
        let checksum_header = sha1_b64.clone();
        let content_length = file_data.len().to_string();
        let upload_headers = ehttp::Headers::new(&[
            ("Content-Type", &content_type),
            ("X-Amz-Checksum-Sha1", &checksum_header),
            ("Content-Length", &content_length),
        ]);

        let upload_request = {
            #[cfg(target_arch = "wasm32")]
            {
                ehttp::Request {
                    method: "PUT".to_string(),
                    url: stage1.url.clone(),
                    body: file_data,
                    headers: upload_headers,
                    mode: ehttp::Mode::Cors,
                }
            }
            #[cfg(not(target_arch = "wasm32"))]
            {
                ehttp::Request {
                    method: "PUT".to_string(),
                    url: stage1.url.clone(),
                    body: file_data,
                    headers: upload_headers,
                }
            }
        };

        let upload_response = self.send_request(upload_request).await?;
        if !(200..=299).contains(&upload_response.status) {
            return Err(format!(
                "Upload to storage failed: {}",
                upload_response.status
            ));
        }

        self.upload_stage2_confirm(&stage1.id).await?;
        Ok(format!("Upload successful: {}", stage1.filename))
    }

    async fn send_request(&self, request: ehttp::Request) -> Result<ehttp::Response, String> {
        let id: u64 = {
            #[cfg(target_arch = "wasm32")]
            {
                REQ_COUNTER.with(|c| {
                    let v = c.get() + 1;
                    c.set(v);
                    v
                })
            }
            #[cfg(not(target_arch = "wasm32"))]
            {
                REQ_COUNTER.fetch_add(1, std::sync::atomic::Ordering::SeqCst) + 1
            }
        };
        crate::console_log!("HTTP_REQ #{} {} {}", id, request.method, request.url);
        #[cfg(not(target_arch = "wasm32"))]
        {
            let (sender, receiver) = mpsc::channel();
            ehttp::fetch(request, move |result| {
                let _ = sender.send(result);
            });
            match receiver.recv_timeout(Duration::from_secs(30)) {
                Ok(Ok(response)) => Ok(response),
                Ok(Err(e)) => Err(format!("Request failed: {}", e)),
                Err(_) => Err("Request timeout".to_string()),
            }
        }
        #[cfg(target_arch = "wasm32")]
        {
            use futures_channel::oneshot;
            let (tx, rx) = oneshot::channel();
            ehttp::fetch(request, move |result| {
                let _ = tx.send(result.map_err(|e| format!("Request failed: {}", e)));
            });
            match rx.await {
                Ok(r) => r,
                Err(_) => Err("Request cancelled".to_string()),
            }
        }
    }
}

pub async fn verify_api_key(api_key: &str, base_url: &str) -> Result<UserInfo, String> {
    let mut client = ApiClient::new(base_url.to_string());
    client.verify_api_key(api_key.to_string()).await
}
