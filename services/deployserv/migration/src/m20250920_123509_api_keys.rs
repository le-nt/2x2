use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table(ApiKey::Table)
                    .if_not_exists()
                    .col(ColumnDef::new(ApiKey::Id).uuid().not_null().primary_key())
                    .col(ColumnDef::new(ApiKey::Key).string().not_null().unique_key())
                    .col(ColumnDef::new(ApiKey::Role).string().not_null())
                    .col(ColumnDef::new(ApiKey::Active).boolean().not_null())
                    .col(ColumnDef::new(ApiKey::CreatedAt).timestamp().not_null())
                    .to_owned(),
            )
            .await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(ApiKey::Table).to_owned())
            .await
    }
}

#[derive(DeriveIden)]
enum ApiKey {
    Table,
    Id,
    Key,
    Role,
    Active,
    CreatedAt,
}
