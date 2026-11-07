import config from "./config";
import logger from "./logger";
import axios from "axios";
import { TurnstileResult } from "@/types/types";

const secretKey = config.turnstile.secretKey;

async function validateTurnstile(token: string): Promise<TurnstileResult> {
    logger.info(`Validating Turnstile token: ${token}`);
    try {
        logger.debug(`Sending request to siteverify endpoint`);

        const params = new URLSearchParams();
        params.append("secret", secretKey);
        params.append("response", token);

        const response = await axios.post(
            "https://challenges.cloudflare.com/turnstile/v0/siteverify",
            params,
            {
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded"
                }
            }
        );

        if (response.data.success) {
            logger.debug(`Turnstile validation successful: ${JSON.stringify(response.data)}`);
            return {
                success: true,
                challenge_ts: response.data.challenge_ts,
                hostname: response.data.hostname
            };
        } else {
            return {
                success: false,
                errorCodes: response.data["error-codes"] || []
            };
        }
    } catch (error: any) {
        logger.debug(`Turnstile validation failed: ${error}`);
        return { success: false, errorCodes: error.response?.data?.["error-codes"] || ["unknown_error"] };
    }
}

export default { validateTurnstile };
