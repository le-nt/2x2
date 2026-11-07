use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table(App::Table)
                    .if_not_exists()
                    .col(ColumnDef::new(App::Id).uuid().not_null().primary_key())
                    .col(ColumnDef::new(App::Name).string().not_null().unique_key())
                    .to_owned(),
            )
            .await?;

        manager
            .create_table(
                Table::create()
                    .table(Channel::Table)
                    .if_not_exists()
                    .col(ColumnDef::new(Channel::Id).uuid().not_null().primary_key())
                    .col(ColumnDef::new(Channel::AppId).uuid().not_null())
                    .col(ColumnDef::new(Channel::Name).string().not_null())
                    .col(ColumnDef::new(Channel::Public).boolean().not_null())
                    .col(ColumnDef::new(Channel::Default).boolean().not_null())
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk-channel-app_id")
                            .from(Channel::Table, Channel::AppId)
                            .to(App::Table, App::Id)
                            .on_delete(ForeignKeyAction::Cascade)
                            .on_update(ForeignKeyAction::Cascade),
                    )
                    .index(
                        Index::create()
                            .name("idx-channel-app_id-name-unique")
                            .col(Channel::AppId)
                            .col(Channel::Name)
                            .unique(),
                    )
                    .to_owned(),
            )
            .await?;

        manager
            .create_table(
                Table::create()
                    .table(Deployment::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(Deployment::Id)
                            .string_len(16)
                            .not_null()
                            .primary_key(),
                    )
                    .col(ColumnDef::new(Deployment::AppId).uuid().not_null())
                    .col(ColumnDef::new(Deployment::Filename).string().not_null())
                    .col(ColumnDef::new(Deployment::SHA1).string().not_null())
                    .col(ColumnDef::new(Deployment::CreatedAt).timestamp().not_null())
                    .col(ColumnDef::new(Deployment::ChannelId).uuid().not_null())
                    .col(ColumnDef::new(Deployment::IsDone).boolean().not_null())
                    .col(ColumnDef::new(Deployment::IsAvailable).boolean().not_null())
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk-deployment-app_id")
                            .from(Deployment::Table, Deployment::AppId)
                            .to(App::Table, App::Id)
                            .on_delete(ForeignKeyAction::Cascade)
                            .on_update(ForeignKeyAction::Cascade),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk-deployment-channel_id")
                            .from(Deployment::Table, Deployment::ChannelId)
                            .to(Channel::Table, Channel::Id)
                            .on_delete(ForeignKeyAction::Cascade)
                            .on_update(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(Deployment::Table).to_owned())
            .await?;
        manager
            .drop_table(Table::drop().table(Channel::Table).to_owned())
            .await?;
        manager
            .drop_table(Table::drop().table(App::Table).to_owned())
            .await?;
        Ok(())
    }
}

#[derive(DeriveIden)]
enum App {
    Table,
    Id,
    Name,
}

#[derive(DeriveIden)]
enum Channel {
    Table,
    Id,
    AppId,
    Name,
    Public,
    Default,
}

#[derive(DeriveIden)]
enum Deployment {
    Table,
    Id,
    AppId,
    Filename,
    SHA1,
    CreatedAt,

    ChannelId,
    IsDone,
    IsAvailable,
}
