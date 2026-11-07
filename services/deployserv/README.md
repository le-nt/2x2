# Deployments Service
This service acts as a middleman between potential Clients e.g Bootstrapper/Web Browser and an Amazon S3 instance.

## Usage
We expect you to have an Amazon R2 bucket, and access to PostgreSQL and rustup tools.\
We also expect you to have `wasm-bindgen` installed.

1. Fill out this config.json example with your details:
```json
{
    "server": {
        "port": 69,
        "override_key": "<Your totally random and secure override key here>"
    },
    "r2": {
        "account_id": "Cloudflare Account ID (<numbers>.r2.cloudflarestorage.com)",
        "bucket": "<Bucket Name>",
        "access_key_id": "<Access Key ID>",
        "secret_access_key": "<Secret Access Key>"
    },
    "database_url": "<PostgreSQL connection string>"
}
```
2. Build the Admin UI.
   
   First, build the WebAssembly:
   ```bash
   cd admin-ui
   cargo build --target wasm32-unknown-unknown --release --lib
   ```
   
   Then, generate the JavaScript bindings:
   ```bash
   cargo run --bin bindgen release
   ```
   
   This will create the admin UI files in `admin-ui/dist/`.

    > **Important:** The service embeds the contents of `admin-ui/dist/` at compile time. Always run the two commands above **before** rebuilding `deployserv` so the binary ships with matching JS/WASM assets.

3. Build the main service with `cargo build --release`.

   You should then have an executable built in `target/release`. We will assume you are in this directory.

4. Run `./deployserv --migrate up` and wait for it to complete. Make sure you have a table created in PostgreSQL already.

5. Then, you can just do `./deployserv --config <Config Path>` and it'll run. Enjoy :-)

