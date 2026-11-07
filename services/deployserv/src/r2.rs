use crate::cfg;
use aws_config::BehaviorVersion;
use aws_config::meta::region::RegionProviderChain;
use aws_sdk_s3::{Client, config::Region};
use once_cell::sync::OnceCell;

static S3_CLIENT: OnceCell<Client> = OnceCell::new();

pub async fn create_s3_client() -> Client {
    println!("Initializing S3...");
    let config = cfg::get_config();
    let r2_config = &config.r2;

    let region_provider = RegionProviderChain::default_provider().or_else(Region::new("auto"));
    let endpoint_url = format!("https://{}.r2.cloudflarestorage.com", r2_config.account_id);

    let creds = aws_sdk_s3::config::Credentials::new(
        &r2_config.access_key_id,
        &r2_config.secret_access_key,
        None,
        None,
        "aws-sdk-s3",
    );

    let aws_config = aws_config::defaults(BehaviorVersion::latest())
        .region(region_provider)
        .credentials_provider(creds)
        .endpoint_url(endpoint_url)
        .load()
        .await;

    println!("Done!");
    let c = Client::new(&aws_config);
    S3_CLIENT
        .set(c.clone())
        .expect("Failed to initialize S3 client");
    c
}

pub async fn get_s3_client() -> &'static Client {
    if S3_CLIENT.get().is_none() {
        let client = create_s3_client().await;
        S3_CLIENT
            .set(client)
            .expect("Failed to initialize S3 client");
    }
    S3_CLIENT.get().unwrap()
}
