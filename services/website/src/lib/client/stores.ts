import { afterNavigate } from "$app/navigation";
import { writable } from "svelte/store";

export const loginError = writable("");
export const pageTitle = writable("");

export const setTitle = (value: string) => {
    afterNavigate(() => pageTitle.set(value));
}