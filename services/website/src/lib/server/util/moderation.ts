// * Function used for text moderation
import config from "./config";
import logger from "./logger";

async function filterText(input: string): Promise<string> {
    const { enabled, url } = config.filtering;

    if (!enabled || !input.trim()) {
        return input;
    }

    const normalizedInput = input
        .replace(/1/g, "i")
        .replace(/6/g, "g")
        .replace(/3/g, "e");

    try {
        const res = await fetch(`${url}/check`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: normalizedInput }),
        });
        if (!res.ok) {
            logger.warn("Couldn't filter text, server returned bad status")
            return input;
        }

        const { flagged_categories, scores } = await res.json();
        if (!Array.isArray(flagged_categories) || typeof scores !== "object") {
            logger.warn("Invalid response from textfilter api")
            return input;
        }

        const isBlocked = flagged_categories.includes("identity_attack")
        return isBlocked ? "[ Content Deleted ]" : input;
    } catch (error) {
        logger.error("Error filtering text", error);
        return input;
    }
}


export default { filterText }