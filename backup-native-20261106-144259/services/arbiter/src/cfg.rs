use serde_derive::{Deserialize, Serialize};
use std::fs::File;
use once_cell::sync::OnceCell;
use rand::Rng;

use crate::{ArbiterError};
use std::collections::HashMap;
use std::sync::OnceLock;
use std::sync::Mutex;
use tokio::process::Child;

static CONFIG: OnceCell<Config> = OnceCell::new();
// JobId => (network_server_port, soap_port, rcc_child_process)
pub static STORE: OnceLock<Mutex<HashMap<String, (i32, i32, Child)>>> = OnceLock::new(); // so readable

#[derive(Serialize, Deserialize, Clone)]
pub struct Config {
    pub server: ServerConfig,
    // pub gameserver: RccConfig,
    pub tls: Option<TlsConfig>,
    pub access_key: String,
    pub base_url: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct ServerConfig {
    pub port: i32,
    pub soap_port_range: RCCPortConfig,
    pub network_server_port_range: RCCPortConfig,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct RCCPortConfig {
    pub start: i32,
    pub end: i32,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct TlsConfig {
    pub cert_path: String,
    pub key_path: String
}

// #[derive(Serialize, Deserialize, Clone)]
// pub struct RccConfig {
//     pub path: String,
// }

pub fn init_store() -> Result<(), ArbiterError> {
    if STORE.get().is_some() {
        return Err(ArbiterError::InitConfigError("Store already initialized".to_string()));
    }

    STORE.set(Mutex::new(HashMap::new()))
        .map_err(|_| ArbiterError::InitConfigError("Store already initialized".to_string()))?;

    Ok(())
}


pub fn init_config(config_path: &str) -> Result<(), ArbiterError> {
    if config_path.trim().is_empty() {
        return Err(ArbiterError::EmptyConfigPath);
    }

    let file = File::open(config_path).map_err(ArbiterError::FileOpen)?;
    let config: Config = serde_json::from_reader(file).map_err(ArbiterError::ConfigParse)?;

    // Validate server port
    if !(1..=65535).contains(&config.server.port) {
        return Err(ArbiterError::InvalidPort(config.server.port));
    }

    // Validate soap_port_range
    let soap = &config.server.soap_port_range;
    if !(1..=65535).contains(&soap.start)
        || !(1..=65535).contains(&soap.end)
        || soap.start >= soap.end
    {
        return Err(ArbiterError::InvalidPortRange(soap.start, soap.end));
    }

    // Validate network_server_port_range
    let net = &config.server.network_server_port_range;
    if !(1..=65535).contains(&net.start)
        || !(1..=65535).contains(&net.end)
        || net.start >= net.end
    {
        return Err(ArbiterError::InvalidPortRange(net.start, net.end));
    }

    // Validate TLS config
    if let Some(tls) = &config.tls {
        let cert_path = std::path::Path::new(&tls.cert_path);
        let cert_path_abs = if cert_path.is_absolute() {
            cert_path.to_path_buf()
        } else {
            std::env::current_dir().unwrap_or_default().join(cert_path)
        };
        if !cert_path_abs.exists() {
            return Err(ArbiterError::InitConfigError(format!("TLS cert file does not exist: {}", cert_path_abs.display())));
        }

        let key_path = std::path::Path::new(&tls.key_path);
        let key_path_abs = if key_path.is_absolute() {
            key_path.to_path_buf()
        } else {
            std::env::current_dir().unwrap_or_default().join(key_path)
        };
        if !key_path_abs.exists() {
            return Err(ArbiterError::InitConfigError(format!("TLS key file does not exist: {}", key_path_abs.display())));
        }
    }

    // Validate access_key
    if config.access_key.trim().is_empty() {
        return Err(ArbiterError::InitConfigError("Access key cannot be empty".to_string()));
    }

    // Validate baseUrl
    if config.base_url.trim().is_empty() {
        return Err(ArbiterError::InitConfigError("BaseURL cannot be empty".to_string()));
    }
    if !(config.base_url.starts_with("http://") || config.base_url.starts_with("https://")) {
        return Err(ArbiterError::InitConfigError("BaseURL must start with 'http://' or 'https://'".to_string()));
    }

    // Check if already initialized
    if CONFIG.get().is_some() {
        return Err(ArbiterError::InitConfigError("Config already initialized".to_string()));
    }

    CONFIG
        .set(config)
        .map_err(|_| ArbiterError::InitConfigError("Config already initialized".to_string()))?;
    Ok(())
}

pub fn get_config() -> Result<&'static Config, ArbiterError> {
    CONFIG.get().ok_or(ArbiterError::InitConfigError("Config not initialized".to_string()))
}

pub fn get_usable_port_soap() -> Result<i32, ArbiterError> {
    let config = get_config()?;
    let port_range = &config.server.soap_port_range;

    if port_range.start <= 0 || port_range.end > 65535 || port_range.start >= port_range.end {
        return Err(ArbiterError::InvalidPortRange(
            port_range.start,
            port_range.end,
        ));
    }

    let mut rng = rand::rng();
    let mut tries = 100;
    while tries > 0 {
        let port = rng.random_range(port_range.start..=port_range.end);
        if port != config.server.port && (1..=65535).contains(&port) {
            return Ok(port);
        }
        tries -= 1;
    }
    Err(ArbiterError::InitConfigError("Failed to find usable port".to_string()))
}

pub fn get_usable_port_game() -> Result<i32, ArbiterError> {
    let config = get_config()?;
    let port_range = &config.server.network_server_port_range;

    if port_range.start <= 0 || port_range.end > 65535 || port_range.start >= port_range.end {
        return Err(ArbiterError::InvalidPortRange(
            port_range.start,
            port_range.end,
        ));
    }

    let mut rng = rand::rng();
    let mut tries = 100;
    while tries > 0 {
        let port = rng.random_range(port_range.start..=port_range.end);
        if port != config.server.port && (1..=65535).contains(&port) {
            return Ok(port);
        }
        tries -= 1;
    }
    Err(ArbiterError::InitConfigError("Failed to find usable port".to_string()))
}