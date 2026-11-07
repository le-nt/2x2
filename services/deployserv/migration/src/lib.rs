pub use sea_orm_migration::prelude::*;

pub struct Migrator;

#[async_trait::async_trait]
impl MigratorTrait for Migrator {
    fn migrations() -> Vec<Box<dyn MigrationTrait>> {
        vec![
            Box::new(m20250805_110231_create_table_app::Migration),
            Box::new(m20250920_104140_acl_system::Migration),
            Box::new(m20250920_123509_api_keys::Migration),
        ]
    }
}
mod m20250805_110231_create_table_app;
mod m20250920_104140_acl_system;
mod m20250920_123509_api_keys;
