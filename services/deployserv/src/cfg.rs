use once_cell::sync::OnceCell;
use serde_derive::{Deserialize, Serialize};
use std::fs::File;

static CONFIG: OnceCell<Config> = OnceCell::new();

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Config {
    pub server: ServerConfig,
    pub r2: R2Config,
    pub database_url: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ServerConfig {
    pub port: i32,
    pub override_key: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct R2Config {
    pub bucket: String,
    pub account_id: String,
    pub access_key_id: String,
    pub secret_access_key: String,
}

pub fn init_config(config_path: &str) {
    if config_path.trim().is_empty() {
        panic!("Config path cannot be empty");
    }

    let file = File::open(config_path).expect("Failed to open config file");
    let config: Config = serde_json::from_reader(file).expect("Failed to parse config file");

    if !(1..=65535).contains(&config.server.port) {
        panic!("Invalid server port: {}", config.server.port);
    }

    if CONFIG.get().is_some() {
        panic!("Config already initialized");
    }

    if config.database_url.is_empty() {
        panic!("Database URL cannot be empty");
    }
    if config.r2.account_id.is_empty() {
        panic!("R2 account ID cannot be empty");
    }
    if config.r2.bucket.is_empty() {
        panic!("R2 bucket cannot be empty");
    }
    if config.r2.access_key_id.is_empty() {
        panic!("R2 access key ID cannot be empty");
    }
    if config.r2.secret_access_key.is_empty() {
        panic!("R2 secret access key cannot be empty");
    }

    CONFIG.set(config).expect("Failed to initialize config");
}

pub fn get_config() -> &'static Config {
    CONFIG.get().expect("Config not initialized")
}
