extern crate rocket;
use clap::{Arg, Command};
use env_logger;
use log::{error, info};
use rocket::figment::{Figment, providers::Serialized};
use rocket::{
    Rocket,
    fairing::{Fairing, Info, Kind},
};
use std::net::{Ipv4Addr};
use std::process;
use crate::cfg::{get_config};

mod catchers;
mod cfg;
mod auth;
mod rcc;
mod responses;
mod routes;
mod udp_relay;
mod ports;
mod version;

#[derive(Debug)]
pub enum ArbiterError {
    FileOpen(std::io::Error),
    ConfigParse(serde_json::Error),
    EmptyConfigPath,
    InvalidPort(i32),
    InitConfigError(String),
    NoRccBundled,
    InvalidPortRange(i32, i32),
    RccServiceError(String),
    RccServiceStartError(String),
}

struct LaunchEvents;

#[rocket::async_trait]
impl Fairing for LaunchEvents {
    fn info(&self) -> Info {
        Info {
            name: "Liftoff",
            kind: Kind::Liftoff,
        }
    }

    async fn on_liftoff(&self, rocket: &Rocket<rocket::Orbit>) {
        let cfg = rocket.config();
        if !version::is_debug() {
            info!("Service running at {}:{}", cfg.address, cfg.port);
        }
    }
}

#[rocket::main]
async fn main() -> Result<(), rocket::Error> {
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info"))
        .filter_module(
            "rocket",
            if version::is_debug() {
                log::LevelFilter::max()
            } else {
                log::LevelFilter::Off
            },
        )
        .init();

    let args = Command::new("Arbiter")
        .about("The Moonic Game Arbiter")
        .version(version::get_version())
        .arg(
            Arg::new("configfile")
                .short('c')
                .long("config")
                .value_name("FILE")
                .required(true),
        )
        .arg(
            Arg::new("update")
                .long("update")
                .value_name("url")
                .hide(true)
                .action(clap::ArgAction::Set),
        )
            .arg(
                Arg::new("rccpath")
                    .long("rcc-path")
                    .value_name("PATH")
                    .required(true)
            )
        .get_matches();

    let config_path = match args.get_one::<String>("configfile") {
        Some(path) => path,
        None => {
            error!("Config file path is empty");
            process::exit(1);
        }
    };

    let rcc_path = match args.get_one::<String>("rccpath") {
        Some(path) => path,
        None => {
            error!("--rcc-path is required");
            process::exit(1);
        }
    };

    if let Err(e) = rcc::set_rcc_path(rcc_path) {
        error!("Invalid RCCService path provided: {:?}", e);
        process::exit(1);
    }

    info!("Reading config from: {}", config_path);

    if let Err(e) = cfg::init_config(config_path).and_then(|_| cfg::init_store()) {
        match &e {
            ArbiterError::NoRccBundled => {panic!("Unexpected ArbiterError: {:?}", e);}
            ArbiterError::RccServiceError(msg) => {panic!("Unexpected ArbiterError: {}", msg);}
            ArbiterError::RccServiceStartError(msg) => {panic!("Unexpected ArbiterError: {}", msg);}
            ArbiterError::InvalidPortRange(start, end) => error!(
                "Invalid port range specified: {}-{}. Must be between 1 and 65535.",
                start, end
            ),
            ArbiterError::InvalidPort(port) => error!(
                "Invalid port specified: {}. Must be between 1 and 65535.",
                port
            ),
            ArbiterError::EmptyConfigPath => error!("Config file path cannot be empty."),
            ArbiterError::FileOpen(_) => error!("Failed to open config file: {}", config_path),
            ArbiterError::ConfigParse(_) => error!("Failed to parse config file: {}", config_path),
            ArbiterError::InitConfigError(_) => error!(
                "Failed to initialize config: InitConfigError\nThis is an internal error."
            ),
        }
        error!("Failed to read config: {:?}", e);
        process::exit(1);
    }

    let config = get_config().expect("Config not initialized. This is an internal error.");

    info!("Starting service...");

    let mut figment =
        Figment::from(rocket::Config::default()).merge(Serialized::defaults(rocket::Config {
            address: Ipv4Addr::new(127, 0, 0, 1).into(), // Private worker; browsers connect through 2x2
            port: config.server.port as u16,
            log_level: rocket::config::LogLevel::Off,
            ..Default::default()
        }));

    // TLS configuration
    if let Some(tls) = &config.tls {
        info!("TLS is enabled");
        figment = figment.merge(("tls", rocket::config::TlsConfig::from_paths(&tls.cert_path, &tls.key_path)));
    }   

    let mut rocket = rocket::custom(figment)
        .register("/", catchers::all())
        .mount("/", routes::all());

    rocket = rocket.attach(LaunchEvents);

    let rocket = rocket.ignite().await?;
    // let shutdown_handle = rocket.shutdown();
    let _ = rocket.launch().await?;

    Ok(())
}
