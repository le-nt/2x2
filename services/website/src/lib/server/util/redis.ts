import Redis from "ioredis";
import config from "./config";
import logger from "./logger";

class ExtendedRedis extends Redis {
    async acquireLock(key: string, ttl: number) {
        const lockValue = `${Date.now()}-${Math.random()}`;
        const result = await this.set(key, lockValue, "EX", ttl);
        if (result === "OK") return lockValue;
        return null;
    }

    async releaseLock(key: string) {
        const value = await this.get(key);
        if (value !== null) await this.del(key);
    }

    async doWithLock<T>(
        key: string,
        ttl: number,
        fn: () => Promise<T>
    ): Promise<T> {
        const lockValue = `${Date.now()}-${Math.random()}`;
        const acquired = await this.set(key, lockValue, "EX", ttl);
        if (!acquired) {
            throw new Error(`Could not acquire lock for ${key}`);
        }

        try {
            return await fn();
        } finally {
            const currentValue = await this.get(key);
            if (currentValue === lockValue) {
                await this.del(key);
            }
        }
    }
}

const extendedRedis = new ExtendedRedis({
    port: config.redis.port,
    host: config.redis.host,
    username: config.redis.username,
    password: config.redis.password,
});

extendedRedis.on("error", (err) => {
    logger.error("Redis error:", err);
});

export default extendedRedis;