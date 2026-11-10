use crate::responses;
use crate::rcc;
use crate::cfg::STORE;
use crate::auth::AccessKey;

use rocket::{get, post, routes, Route};
use rocket::serde::json::Json;

use rocket::futures::{SinkExt, StreamExt};
use rocket_ws::{Message, WebSocket};
use tokio::net::UdpSocket;

#[get("/health")]
#[allow(non_snake_case, dead_code)]
pub fn HealthCheck() -> &'static str {
    "OK"
}

#[post("/gameserver/new", data = "<json>")]
#[allow(non_snake_case, dead_code)]
pub async fn NewGameServer(
    _key: AccessKey,
    json: Json<responses::NewGameServerRequest>
) -> Json<responses::NewGameServerResponse> {
    let place_id = json.place_id;
    let response = rcc::util::new_gameserver(place_id).await;

    match response {
        Ok(job_id) =>
            Json(responses::NewGameServerResponse {
                success: true,
                message: "Game server created successfully".to_string(),
                job_id,
            }),
        Err(e) =>
            Json(responses::NewGameServerResponse {
                success: false,
                message: format!("Failed to create game server: {:?}", e),
                job_id: String::new(),
            }),
    }
}

#[post("/gameserver/renew-lease", data = "<json>")]
#[allow(non_snake_case)]
pub async fn RenewGameServerLease(
    _key: AccessKey,
    json: Json<responses::RenewGameServerLeaseRequest>
) -> Json<responses::RenewGameServerLeaseResponse> {
    let job_id = json.job_id.clone();
    let lease = json.lease;

    let response = rcc::util::renew_gs_lease(job_id, lease).await;
    match response {
        Ok(_) =>
            Json(responses::RenewGameServerLeaseResponse {
                success: true,
                message: "Lease renewed successfully".to_string(),
            }),
        Err(e) =>
            Json(responses::RenewGameServerLeaseResponse {
                success: false,
                message: format!("Failed to renew lease: {:?}", e),
            }),
    }
}

#[post("/gameserver/reported-closed", data = "<json>")]
#[allow(non_snake_case)]
pub async fn ReportedGameServerClosed(
    _key: AccessKey,
    json: Json<responses::ReportedGameServerClosedRequest>
) -> Json<responses::ReportedGameServerClosedResponse> {
    let job_id = json.job_id.clone();
    let response = rcc::util::report_gs_closed(job_id).await;
    match response {
        Ok(_) =>
            Json(responses::ReportedGameServerClosedResponse {
                success: true,
                message: "Game server reported closed successfully".to_string(),
            }),
        Err(e) =>
            Json(responses::ReportedGameServerClosedResponse {
                success: false,
                message: format!("Failed to report game server closed: {:?}", e),
            }),
    }
}

#[post("/rendering/dispatch-avatar", data = "<json>")]
#[allow(non_snake_case)]
pub async fn DispatchAvatarRendering(
    _key: AccessKey,
    json: Json<responses::DispatchAvatarRenderingRequest>
) -> Json<responses::DispatchAvatarRenderingResponse> {
    let user_id = json.user_id;
    let hash = json.hash.clone();
    let format = json.format.clone();
    let sizes = json.sizes.clone();
    let bust = json.bust;
    log::info!("Begin avatar rendering for UserID {} with format: {}, bust: {}", user_id, format, bust);

    tokio::spawn(async move {
        let _ = rcc::util::do_avatar_batch(user_id, format, hash, bust, sizes).await;
    });

    Json(responses::DispatchAvatarRenderingResponse {
        success: true,
    })
}

#[post("/rendering/dispatch-asset", data = "<json>")]
#[allow(non_snake_case)]
pub async fn DispatchAssetRendering(
    _key: AccessKey,
    json: Json<responses::DispatchAssetRenderingRequest>
) -> Json<responses::Response> {
    let asset_id = json.asset_id;
    let global_version_id = json.global_version_id;
    let format = json.format.clone();
    let sizes = json.sizes.clone();
    let thumbnail_type = json.thumbnail_type.clone();
    let mannequin_or_universe_id = json.mannequin_or_universe_id;

    tokio::spawn(async move {
        let _ = rcc::util::do_asset_batch(global_version_id, asset_id, format, thumbnail_type, sizes, mannequin_or_universe_id).await;
    });

    Json(responses::Response {
        success: true,
        message: "ok"
    })
}


#[post("/dispatch-validation", data = "<json>")]
#[allow(non_snake_case)]
pub async fn DispatchAssetValidation(
    _key: AccessKey,
    json: Json<responses::DispatchAssetValidationRequest>
) -> Json<responses::Response> {
    tokio::spawn(async move {
        let _ = rcc::util::validate_asset(json.asset_id).await;
    });
    Json(responses::Response {
        success: true,
        message: "ok"
    })
}

#[get("/test-ws")]
#[allow(non_snake_case, dead_code)]
pub fn TestWebSocket(ws: WebSocket) -> rocket_ws::Channel<'static> {
    ws.channel(|mut stream| {
        Box::pin(async move {
            while let Some(msg) = stream.next().await {
                match msg {
                    Ok(Message::Text(text)) => {
                        let _ = stream.send(Message::Text("hi".to_string())).await;
                        break;
                    }
                    Ok(Message::Binary(bin)) => {
                        let _ = stream.send(Message::Binary("hi".into())).await;
                        break;
                    }
                    Ok(Message::Close(_)) => {
                        break;
                    }
                    Ok(_) => {
                        break;
                    }
                    Err(e) => {
                        eprintln!("WebSocket error: {}", e);
                        break;
                    }
                }   
            }
            Ok(())
        })
    })
}

#[get("/ws/<job_id>")]
#[allow(non_snake_case)]
pub fn SocketForwarding(job_id: String, ws: WebSocket, _key: AccessKey) -> rocket_ws::Channel<'static> {
    ws.channel(move |mut stream| {
        Box::pin(async move {
            let portMap = {
                let store = STORE.get().expect("STORE must be initialized").lock().unwrap();
                store.get(&job_id).map(|&(port, soap, _)| (port, soap))
            }; // (network_server_port, soap_port)

            let (port, _) = match portMap {
                Some(p) => p,
                None => {
                    println!("Invalid JobId: {}", job_id);
                    let _ = stream.send(Message::Text("Invalid JobId".into())).await;
                    return Ok(());
                }
            };

            let udp_socket = match UdpSocket::bind("127.0.0.1:0").await {
                Ok(socket) => {
                    println!(
                        "UDP socket bound for job_id {} on local port {}",
                        job_id,
                        socket.local_addr().unwrap()
                    );
                    socket
                }
                Err(e) => {
                    eprintln!("Failed to bind UDP socket: {}", e);
                    let _ = stream.send(Message::Close(None)).await;
                    return Ok(());
                }
            };
            let udp_target = format!("127.0.0.1:{}", port);
            println!("UDP target for job_id {}: {}", job_id, udp_target);

            // Filter incoming datagrams to this job's native server. Keeping
            // receive in the relay future also releases the socket on EOF or
            // handler cancellation, even when no further UDP packet arrives.
            if let Err(error) = udp_socket.connect(&udp_target).await {
                eprintln!("UDP connect failed for job_id {}: {}", job_id, error);
                let _ = stream.send(Message::Close(None)).await;
                return Ok(());
            }
            let reason = crate::udp_relay::forward(stream, udp_socket).await;
            println!("Connection for job_id {} closed: {:?}", job_id, reason);
            Ok(())
        })
    })
}

pub fn all() -> Vec<Route> {
    routes![
        HealthCheck,
        NewGameServer,
        DispatchAvatarRendering,
        DispatchAssetRendering,
        DispatchAssetValidation,
        RenewGameServerLease,
        ReportedGameServerClosed,
        SocketForwarding,
    ]
}
