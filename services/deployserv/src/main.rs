use actix_cors::Cors;
use actix_web::{App, HttpServer};
use clap::{Arg, Command};
use sea_orm::DbErr;
use std::process::exit;

mod acl;
mod admin_ui;
mod auth;
mod cfg;
mod postgres;
mod r2;
mod routes;
mod version;

#[tokio::main]
async fn main() -> Result<(), DbErr> {
    let args = Command::new("DeployServ")
        .about("Deployments Service")
        .version(version::get_version())
        .arg(
            Arg::new("configfile")
                .short('c')
                .long("config")
                .value_name("FILE")
                .required(true),
        )
        .arg(
            Arg::new("migrate")
                .long("migrate")
                .value_name("UP/DOWN")
                .help("Add database migrations"),
        )
        .get_matches();

    let config_path = args
        .get_one::<String>("configfile")
        .expect("Config file is required");
    let migrate = args
        .get_one::<String>("migrate")
        .map(|s| s.to_lowercase())
        .unwrap_or_else(|| "".to_string());
    cfg::init_config(config_path);
    let config = cfg::get_config();

    postgres::init_db_pool(config).await?;
    let db_conn = postgres::get_db_pool();
    match migrate.as_str() {
        "up" => {
            postgres::up().await?;
            exit(0);
        }
        "down" => {
            postgres::down().await?;
            exit(0);
        }
        _ => {}
    }
    r2::create_s3_client().await;
    println!("Starting service on port {}", config.server.port);
    let server = HttpServer::new(move || {
        let cors = Cors::default()
            .allowed_origin("https://www.rbx.pizza")
            .allowed_origin("https://rbx.pizza")
            .allowed_origin_fn(|origin, _req_head| origin.as_bytes().ends_with(b".rbx.pizza"))
            .allowed_origin("http://127.0.0.1:5000")
            .allowed_origin("http://localhost:5000")
            .allow_any_method()
            .allow_any_header();
        App::new()
            .app_data(actix_web::web::Data::new(db_conn.clone()))
            .configure(routes::configure_routes)
            .wrap(cors)
    });
    let listener = server
        .bind(format!("127.0.0.1:{}", config.server.port))
        .map_err(|e| DbErr::Custom(format!("Server bind error: {}", e)))?;
    println!("Service started at 127.0.0.1:{}", config.server.port);
    listener
        .run()
        .await
        .map_err(|e| DbErr::Custom(format!("Server run error: {}", e)))?;

    Ok(())
}
