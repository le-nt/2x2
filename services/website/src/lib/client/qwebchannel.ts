import { browser } from "$app/environment";

let robloxObject: any | null = null;
let channelPromise: Promise<any> | null = null;

export function getRobloxObject(): Promise<any> {
    if (!browser) {
        return Promise.reject(new Error("Cannot get Qt WebChannel on the server"));
    }
    if (robloxObject) {
        return Promise.resolve(robloxObject);
    }
    if (!channelPromise) {
        channelPromise = new Promise((resolve, reject) => {
            // @ts-ignore
            if (!window.qt || !window.qt.webChannelTransport) {
                return reject(new Error("Qt webChannelTransport not available"));
            }
            // @ts-ignore
            new QWebChannel(window.qt.webChannelTransport, (channel: any) => {
                robloxObject = channel.objects.roblox;
                resolve(robloxObject);
            });
        });
    }
    return channelPromise;
}