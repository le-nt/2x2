use crate::api::UserInfo;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthState {
    pub api_key: String,
    pub user_info: Option<UserInfo>,
    pub is_authenticated: bool,
    pub base_url: String,
}

impl Default for AuthState {
    fn default() -> Self {
        Self {
            api_key: String::new(),
            user_info: None,
            is_authenticated: false,
            base_url: "http://localhost:8080".to_string(),
        }
    }
}

impl AuthState {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn set_api_key(&mut self, api_key: String) {
        self.api_key = api_key;
        self.is_authenticated = false;
        self.user_info = None;
    }

    pub fn set_base_url(&mut self, base_url: String) {
        self.base_url = base_url;
    }

    pub fn authenticate(&mut self, user_info: UserInfo) {
        self.user_info = Some(user_info);
        self.is_authenticated = true;
    }

    pub fn logout(&mut self) {
        self.api_key.clear();
        self.user_info = None;
        self.is_authenticated = false;
    }

    pub fn is_admin(&self) -> bool {
        self.user_info
            .as_ref()
            .map(|info| info.role == "admin" || info.is_override)
            .unwrap_or(false)
    }

    pub fn has_permission(&self, privilege: &str) -> bool {
        if let Some(ref user_info) = self.user_info {
            if user_info.is_override || user_info.role == "admin" {
                return true;
            }
            user_info.privileges.contains(&privilege.to_string())
        } else {
            false
        }
    }

    pub fn can_write_apps(&self) -> bool {
        self.has_permission("app.write")
    }

    pub fn can_read_apps(&self) -> bool {
        self.has_permission("app.read")
    }

    pub fn can_write_channels(&self) -> bool {
        self.has_permission("channel.write")
    }

    pub fn can_read_channels(&self) -> bool {
        self.has_permission("channel.read")
    }

    pub fn can_write_deployments(&self) -> bool {
        self.has_permission("deployment.write")
    }

    pub fn can_read_deployments(&self) -> bool {
        self.has_permission("deployment.read")
    }
}
