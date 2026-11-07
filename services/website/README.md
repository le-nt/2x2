# 2x2 🍕

> Who doesn't like pizza?

Spiritual successor to ["ecosim" (economy-simulator.com)](https://github.com/ccr0/economy-simulator) ❤️ — except we don't suck

---

## Requirements

To get started, you'll need:

- [Bun](https://bun.sh/)
- [PostgreSQL](https://www.postgresql.org/) **16+**
- Our custom [Arbiter](https://github.com/MoonicTeam/arbiter) (with open HTTP[S] and WS[S] ports)
- An Amazon S3 instance (any provider)
- Familiarity with **Linux**, **networking**, and **TypeScript**

> **Note:** If you're unfamiliar with all these technologies, don't attempt this pls thanks

---

## Setup

> [!IMPORTANT]
> Build from a Linux host or WSL2.

make sure u clone this repo with --submodules flag
or else u can later pull the submodules with

```bash
bun git submodule update --init --recursive
```

Inside the repository,

1. Install dependencies:
   ```bash
   bun install
   ```
2. create `config.json` in project root
   example:

```json
{
  "databaseUrl": "db url here",
  "encryption": {
    "ipEncryptionKey": "random string",
    "ipSalt": "random string",
    "secureCookies": "random string"
  },
  "webserver": {
    "corsAllowed": ["http://localhost:6554"],
    "assetAccessKey": "random string",
    "baseUrl": "http://localhost:6554",
    "secretKey": "random string",
    "isTestWebsite": true
  },
  "turnstile": {
    "siteKey": "1x00000000000000000000BB",
    "secretKey": "1x0000000000000000000000000000000AA"
  },
  "roblox": {
    "auth": "robloxsecurity cookie here"
  },
  "s3": {
    "accessKeyId": "s3 access key here",
    "secretAccessKey": "s3 secret key here",
    "bucketName": "s3 bucket name here",
    "baseUrl": "http://localhost:9000",
    "endpoint": "http://localhost:9000"
  },
  "redis": {
    "host": "127.0.0.1",
    "port": 6379
  },
  "filtering": {
    "enabled": false,
    "url": "http://localhost:6554/filter"
  },
  "features": { "invites": false },
  "gameTemplates": [
    {
      "id": 1,
      "type": "roblox"
    }
  ]
}
```

3. Initialize the database:
   ```bash
   bun migrate:deploy
   ```
4. Build the project:
   ```bash
   bun run build
   ```

There is no option available for local storage. You **must** use S3.
you can spin up a local s3 testing server with minio

6. Start the backend:
   `bash
 PORT=<your-port> bun ./build/index.js
 `
   See `build/.env.example` for production env

---

Done. That is the most minimal setup: read our code and use the database to make users and invite keys. You're on your own from here maintaining this.
