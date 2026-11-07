import { UserGender } from "@/types/types";
import { api } from "@client/api";
import { browser } from '$app/environment';

export function validGender() {
	return (value: UserGender) => {
		const valid = value === UserGender.Male || value === UserGender.Female;
		return { valid, name: "required" };
	};
}

export function notZeroOrEmpty() {
	return (value: any) => {
		const valid = value !== 0 && value !== "";
		return { valid, name: "required" };
	};
}

export function takenUsername() {
    return async (value: string) => {
		if (!browser) {	
			return { valid: true, name: "taken" };
		}
        const { data } = await api.takenUsername.get(fetch, { query: { username: value } });
        return { valid: !Boolean(data), name: "taken" };
    };
}

export function validInviteCode() {
	return async (value: string) => {
		if (!browser) {
			return { valid: true, name: "invalid" };
		}
		const { data } = await api.validateInviteCode.get(fetch, { query: { code: value } });
		return { valid: Boolean(data), name: "invalid" };
	};
}