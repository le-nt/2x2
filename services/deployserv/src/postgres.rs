use crate::cfg::Config;
use migration::{Migrator, MigratorTrait};
use once_cell::sync::OnceCell;
use sea_orm::{Database, DatabaseConnection, DbErr};

static DB_POOL: OnceCell<DatabaseConnection> = OnceCell::new();

pub async fn init_db_pool(config: &Config) -> Result<(), DbErr> {
    if DB_POOL.get().is_some() {
        return Ok(());
    }

    println!("Initializing database...");
    let pool = Database::connect(&config.database_url).await?;
    DB_POOL.set(pool).expect("Failed to set DB_POOL");
    println!("Done!");
    Ok(())
}

pub fn get_db_pool() -> &'static DatabaseConnection {
    DB_POOL.get().expect("Database not initialized")
}

pub async fn up() -> Result<(), DbErr> {
    println!("Running database migrations...");
    if DB_POOL.get().is_none() {
        return Err(DbErr::Custom("Database pool not initialized".into()));
    }
    let db = get_db_pool();
    Migrator::up(db, None).await?;
    println!("Done!");
    Ok(())
}

pub async fn down() -> Result<(), DbErr> {
    println!("Rolling back database migrations...");
    if DB_POOL.get().is_none() {
        return Err(DbErr::Custom("Database pool not initialized".into()));
    }
    let db = get_db_pool();
    Migrator::down(db, None).await?;
    println!("Done!");
    Ok(())
}
