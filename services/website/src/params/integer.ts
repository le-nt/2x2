import type { ParamMatcher } from "@sveltejs/kit"

export const match: ParamMatcher = param => {
    const value = Number.parseInt(param, 10)
    return (
        Number.isInteger(value) &&
        value <= Number.MAX_SAFE_INTEGER &&
        value >= 0
    )
}