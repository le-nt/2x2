import logger from "@/util/logger";
import config from "@/util/config";
import { S3Client } from "bun";

let s3Client: S3Client;
try {
    s3Client = new S3Client({
        accessKeyId: config.s3.accessKeyId,
        secretAccessKey: config.s3.secretAccessKey,
        ...(config.s3.endpoint ? { endpoint: config.s3.endpoint } : {}),
        bucket: config.s3.bucketName,
    });
    // Verify it works
    await s3Client.list();
} catch (error: any) {
    logger.error(`Fatal error connecting to S3: ${error.message}`)
    process.exit(1);
}

export default s3Client