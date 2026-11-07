import fs from 'fs';
import logger from './logger';

type GameTemplate = {
    id: number;
    type: string;
};

type Config = {
    databaseUrl: string;
    encryption: {
        ipEncryptionKey: string;
        ipSalt: string;
        secureCookies: string;
    }
    webserver: {
        corsAllowed: string | string[];
        assetAccessKey: string;
        baseUrl: string;
        secretKey: string;
        isTestWebsite: boolean;
    },
    turnstile: {
        secretKey: string;
        siteKey: string;
    },
    roblox: {
        auth: string;
    },
    s3: {
        accessKeyId: string;
        secretAccessKey: string;
        bucketName: string;
        baseUrl?: string;
        endpoint?: string;
    },
    redis: {
        username?: string;
        password?: string;
        host: string;
        port: number;
    },
    filtering: {
        enabled: boolean;
        url: string;
    };
    gameTemplates: GameTemplate[];
}

function assertType(value: unknown, type: 'string' | 'number' | 'boolean', key: string): void {
    if (typeof value !== type) {
        throw new Error(`Invalid configuration: "${key}" must be a ${type}`);
    }
}

const configPath = "config.json";
export const loadConfig = (): Config => {
    if (!fs.existsSync(configPath)) {
        throw new Error(`Configuration file not found at ${configPath}`);
    }

    const configData = fs.readFileSync(configPath, 'utf-8');
    try {
        // validate based upon Config
        const parsedConfig: Config = JSON.parse(configData);
        [
            ['databaseUrl', parsedConfig.databaseUrl],
            ['encryption.ipEncryptionKey', parsedConfig.encryption.ipEncryptionKey],
            ['encryption.ipSalt', parsedConfig.encryption.ipSalt],
            ['encryption.secureCookies', parsedConfig.encryption.secureCookies],
            ['webserver.assetAccessKey', parsedConfig.webserver.assetAccessKey],
            ['webserver.baseUrl', parsedConfig.webserver.baseUrl],
            ['webserver.secretKey', parsedConfig.webserver.secretKey], // TODO: is this appropriate to go in encryption?
            ['turnstile.siteKey', parsedConfig.turnstile.siteKey],
            ['turnstile.secretKey', parsedConfig.turnstile.secretKey],
            ['roblox.auth', parsedConfig.roblox.auth],
            ['s3.accessKeyId', parsedConfig.s3.accessKeyId],
            ['s3.secretAccessKey', parsedConfig.s3.secretAccessKey],
            ['s3.bucketName', parsedConfig.s3.bucketName],
            ['filtering.url', parsedConfig.filtering.url],
            ['redis.host', parsedConfig.redis.host],
        ].forEach(([key, val]) => assertType(val, 'string', key));

        if (parsedConfig.redis === undefined) {
            throw new Error('redis configuration is missing');
        }
        assertType(parsedConfig.redis.port, 'number', 'redis.port');
        if (parsedConfig.redis.username !== undefined) {
            assertType(parsedConfig.redis.username, 'string', 'redis.username');
        }
        if (parsedConfig.redis.password !== undefined) {
            assertType(parsedConfig.redis.password, 'string', 'redis.password');
        }

        // enable or disable chat filtering support
        assertType(parsedConfig.filtering.enabled, 'boolean', 'filtering.enabled')

        // corsAllowed which can be string or string[]
        if (Array.isArray(parsedConfig.webserver.corsAllowed)) {
            parsedConfig.webserver.corsAllowed.forEach((item, idx) =>
                assertType(item, 'string', `webserver.corsAllowed[${idx}]`)
            );
        } else {
            assertType(parsedConfig.webserver.corsAllowed, 'string', 'webserver.corsAllowed');
        }
        assertType(parsedConfig.webserver.isTestWebsite, 'boolean', 'webserver.isTestWebsite');

        if (parsedConfig.s3.endpoint !== undefined) {
            assertType(parsedConfig.s3.endpoint, 'string', 's3.endpoint');
        }
        if (parsedConfig.s3.baseUrl !== undefined) {
            assertType(parsedConfig.s3.baseUrl, 'string', 's3.baseUrl')
        }

        if (!Array.isArray(parsedConfig.gameTemplates)) {
            throw new Error('gameTemplates must be an array');
        }
        parsedConfig.gameTemplates.forEach((template, idx) => {
            if (typeof template !== 'object' || template === null) {
                throw new Error(`gameTemplates[${idx}] must be an object`);
            }
            assertType(template.id, 'number', `gameTemplates[${idx}].id`);
            assertType(template.type, 'string', `gameTemplates[${idx}].type`);
        });

        return parsedConfig;
    } catch (error: any) {
        throw new Error(`Error parsing configuration file: ${error.message}`);
    }
};

let config: Config;
try {
    config = loadConfig();
} catch (error: any) {
    logger.error(`${error.message}`);
    process.exit(1);
}
export default config;