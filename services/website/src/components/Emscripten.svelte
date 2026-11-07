<script lang="ts">
    // this code is ass vro
    import { env } from "$env/dynamic/public";
    import { dev } from "$app/environment";
    import { onMount } from "svelte";
    import { XzReadableStream } from "xz-decompress";
    import { TarReader } from "@gera2ld/tarjs";
    import { openDB } from "idb";

    const CACHE_TIME = 7 * 24 * 60 * 60 * 1000; // 7 days

    let isLoading = $state(true);
    let status = $state("");
    let { placeId } = $props();

    async function doesSHA1match(fileBuffer: ArrayBuffer, expectedSHA: string) {
        const sha1 = await crypto.subtle.digest("SHA-1", fileBuffer);
        const hashBase64 = btoa(String.fromCharCode(...new Uint8Array(sha1)));
        return hashBase64 === expectedSHA;
    }

    async function loadCachedBundle(
        url: string,
        verify: string | null,
        deploymentId: string,
    ) {
        // This helper ensures object store exists even if prior versions missed creation
        const db = await openBundleDB();

        // Try cache
        const cached = await db.get("bundles", deploymentId);
        if (cached) {
            const age = Date.now() - cached.timestamp;
            // If a verify hash is provided ensure it matches what we stored. If BAD, we discard
            const verifyMatches =
                !verify || cached.verify === verify;
            if (age < CACHE_TIME && verifyMatches) {
                const fileMap: Record<string, string> = {};
                for (const [name, buffer] of Object.entries(cached.files)) {
                    let type = "";
                    if (name.endsWith(".wasm")) type = "application/wasm";
                    else if (name.endsWith(".js"))
                        type = "application/javascript";
                    else if (name.endsWith(".data"))
                        type = "application/octet-stream";

                    const blob = new Blob([buffer as ArrayBuffer], { type });
                    fileMap[name] = URL.createObjectURL(blob);
                }
                return fileMap;
            } else if (!verifyMatches) {
                await db.delete("bundles", deploymentId);
            }
        }

        const fileMap = await loadBundle(url, verify);

        // Turn blobs in fileMap back to ArrayBuffers for storage
        const files: Record<string, ArrayBuffer> = {};
        for (const [name, objectUrl] of Object.entries(fileMap)) {
            const res = await fetch(objectUrl);
            const buf = await res.arrayBuffer();
            files[name] = buf;
        }

        await db.put(
            "bundles",
            { files, timestamp: Date.now(), verify },
            deploymentId,
        );
        return fileMap;
    }

    // this is used to load a bundle off setup
    // some terrible code but i dont even care
    async function loadBundle(url: string, sha1: string | null) {
        status = "Downloading client data";
        const fileBuffer: ArrayBuffer = await new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open("GET", url, true);
            xhr.responseType = "arraybuffer";

            xhr.onprogress = (e) => {
                if (e.lengthComputable) {
                    status = `Downloading client data: ${((e.loaded / e.total) * 100).toFixed(1)}%`;
                } else {
                    status = `Downloading client data: ${e.loaded} bytes`;
                }
            };

            xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300)
                    resolve(xhr.response);
                else
                    reject(
                        new Error(`Failed to download bundle: ${xhr.status}`),
                    );
            };
            xhr.onerror = () => reject(new Error("Network error"));
            xhr.send();
        });
        status = "Verifying client data";
        if (sha1) {
            if (!(await doesSHA1match(fileBuffer, sha1))) {
                throw new Error("SHA1 mismatch!");
            }
        }

        const fileStream = new ReadableStream<Uint8Array>({
            start(controller) {
                const chunkSize = 64 * 1024;
                const view = new Uint8Array(fileBuffer);
                let offset = 0;
                while (offset < view.length) {
                    const end = Math.min(offset + chunkSize, view.length);
                    controller.enqueue(view.subarray(offset, end));
                    offset = end;
                }
                controller.close();
            },
        });

        status = "Decompressing client data";
        const xzStream = new XzReadableStream(fileStream);
        const tarResponse = new Response(xzStream);
        const tarArrayBuffer = await tarResponse.arrayBuffer();

        const reader = await TarReader.load(tarArrayBuffer);
        const files = reader.fileInfos;
        const fileMap: Record<string, string> = {};

        for (const info of files) {
            let type = "";
            if (info.name.endsWith(".wasm")) type = "application/wasm";
            else if (info.name.endsWith(".js")) type = "application/javascript";
            else if (info.name.endsWith(".data"))
                type = "application/octet-stream";

            const blob = new Blob([reader.getFileBlob(info.name)], { type });
            fileMap[info.name] = URL.createObjectURL(blob);
        }

        return fileMap;
    }

    function openBundleDB() {
        return (async () => {
            // First attempt: open expected version
            let db = await openDB("uc-bundle-cache", 2, {
                upgrade(db) {
                    if (!db.objectStoreNames.contains("bundles")) {
                        // Normal creation path
                        db.createObjectStore("bundles");
                    }
                },
            });

            // Self-heal: If somehow version=2 but store is missing (old broken creation), bump version.
            if (!db.objectStoreNames.contains("bundles")) {
                const nextVersion = db.version + 1;
                db.close();
                try {
                    db = await openDB("uc-bundle-cache", nextVersion, {
                        upgrade(db) {
                            if (!db.objectStoreNames.contains("bundles")) {
                                db.createObjectStore("bundles");
                            }
                        },
                    });
                } catch (e) {
                    // As a last resort, delete the DB entirely (corrupt schema) and recreate cleanly.
                    console.warn("Recreating corrupt uc-bundle-cache DB", e);
                    await indexedDB.deleteDatabase("uc-bundle-cache");
                    db = await openDB("uc-bundle-cache", 1, {
                        upgrade(db) {
                            if (!db.objectStoreNames.contains("bundles")) {
                                db.createObjectStore("bundles");
                            }
                        },
                    });
                }
            }
            return db;
        })();
    }

    onMount(async () => {
        let fileMap: Record<string, string> | null = null;
        let deploymentId: string | null = null; // * In Dev, this should be null. Don't worry about cache in dev.
        const baseUrl = new URL(window.location.href);
        const canvas = document.getElementById("canvas");
        const setupOrigin = env.PUBLIC_SETUP_ORIGIN || baseUrl.origin.replace("www.", "setup.");
        const settingsOrigin = env.PUBLIC_CLIENT_SETTINGS_ORIGIN || baseUrl.origin.replace("www.", "clientsettingscdn.");

        if (!dev) {
            const request = await fetch(
                `${setupOrigin}/api/latest-version?app_name=WebClient&channel_name=live`,
            );
            const json = await request.json();
            if (request.ok && json.version) {
                deploymentId = json.version;
            } else {
                alert(
                    "Failed to get the latest version of ROBLOX. The game will not proceed.",
                );
            }
        }

        if (dev) {
            fileMap = await loadBundle("/UniversalClient.tar.xz", null);
        } else {
            // cache-only path first to avoid generating an unnecessary presigned URL
            async function tryLoadFromCacheOnly(deploymentId: string) {
                try {
                    const db = await openBundleDB();
                    const cached = await db.get("bundles", deploymentId);
                    if (cached) {
                        const age = Date.now() - cached.timestamp;
                        if (age < CACHE_TIME) {
                            status = "Loading cached client data";
                            const map: Record<string, string> = {};
                            for (const [name, buffer] of Object.entries(
                                cached.files,
                            )) {
                                let type = "";
                                if (name.endsWith(".wasm"))
                                    type = "application/wasm";
                                else if (name.endsWith(".js"))
                                    type = "application/javascript";
                                else if (name.endsWith(".data"))
                                    type = "application/octet-stream";
                                const blob = new Blob([buffer as ArrayBuffer], {
                                    type,
                                });
                                map[name] = URL.createObjectURL(blob);
                            }
                            return map;
                        }
                    }
                } catch (e) {
                    // cold start
                }
                return null;
            }

            if (deploymentId) {
                fileMap = await tryLoadFromCacheOnly(deploymentId);
            }

            if (!fileMap) {
                const deployment = await fetch(
                    `${setupOrigin}/api/download?app_name=WebClient&channel_name=live&deployment_id=${deploymentId}`,
                );
                if (!deployment.ok) {
                    alert("Couldn't get client deployment");
                    return;
                }
                const json = await deployment.json();
                try {
                    fileMap = await loadCachedBundle(
                        json.url,
                        json.verify,
                        deploymentId!,
                    );
                } catch (err) {
                    alert(
                        `Bundle failed to load! ROBLOX will not proceed. Error: ${(err as Error).message}`,
                    );
                    return;
                }
            }
        }

        if (!fileMap) {
            alert("Client could not be loaded from setup");
            return;
        }

        // TS narrow
        const finalFileMap = fileMap;

        //@ts-ignore
        window.Module = {
            canvas,
            locateFile: (filename: string) => {
                if (filename.endsWith(".wasm"))
                    return finalFileMap["UniversalClient.wasm"];
                if (filename.endsWith(".data"))
                    return finalFileMap["UniversalClient.data"];
                return filename;
            },
            arguments: [
                `--baseUrl=${baseUrl.origin}/api`,
                `--authenticationUrl=${baseUrl.origin}/Login/Negotiate.ashx`,
                "--authenticationTicket=Test",
                `--joinScriptUrl=${baseUrl.origin}/api/game/placelauncher?placeId=${placeId}`,
            ],
            websocket: {
                subprotocol: null,
            },
            setStatus: function (text: string) {
                status = "Initializing game";
            },
            onRuntimeInitialized: function () {
                isLoading = false;
            },
        };

        document.addEventListener(
            "pointerlockchange",
            () => {
                if (document.pointerLockElement === null) {
                    //@ts-ignore
                    Module.ccall("notifyPointerLockLost", "void", [], []);
                }
            },
            false,
        );

        const clientSettingsCdn = settingsOrigin;
        const salt = Array.from(crypto.getRandomValues(new Uint8Array(4)))
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("");
        console.log(`salt: ${salt}`);
        console.log(
            `Fetching FFlags from: ${dev ? "(DEV)" : `${clientSettingsCdn}/ClientAppSettings.json?${salt}`}`,
        );
        fetch(
            dev
                ? "/ClientAppSettings.json"
                : `${clientSettingsCdn}/ClientAppSettings.json?${salt}`,
        )
            .then((response) => {
                if (!response.ok) return {};
                return response.json();
            })
            .then((data) => {
                // @ts-ignore
                window.Module.fastFlags = JSON.stringify(data);
            })
            .catch((error) => {
                console.error("Error fetching FFlags:", error);
            })
            .finally(() => {
                const jsBlobUrl = finalFileMap["UniversalClient.js"];
                const script = document.createElement("script");
                script.src = jsBlobUrl;
                document.body.appendChild(script);
            });
    });
</script>

{#if isLoading}
    <div class="h-full w-full flex flex-col justify-center items-center">
        <p class="text-2xl font-bold pl-1">Loading 2x2...</p>
        {#if status !== "Running..." && status !== ""}
            <p class="text-lg mt-2">{status}</p>
        {/if}
        <small class="text-gray-500"
            >Your internet may affect load speeds, be patient</small
        >
    </div>
{/if}

<canvas
    id="canvas"
    class:hidden={isLoading}
    oncontextmenu={(e) => e.preventDefault()}
></canvas>

<style>
    #canvas {
        position: absolute;
        top: 0;
        left: 0;
        margin: 0;
        width: 100%;
        height: 100%;
        overflow: hidden;
        display: block;
        z-index: 99;
    }

    #canvas.hidden {
        display: block;
    }
</style>
