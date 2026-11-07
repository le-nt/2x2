use actix_web::{HttpRequest, HttpResponse, Result};
use mime_guess::from_path;
use rust_embed::RustEmbed;

#[derive(RustEmbed)]
#[folder = "admin-ui/dist/"]
struct AdminUIAssets;

pub async fn serve_admin_ui(req: HttpRequest) -> Result<HttpResponse> {
    let path = req.match_info().query("filename");

    let path = if path.is_empty() || path == "/" {
        "index.html"
    } else {
        path.strip_prefix('/').unwrap_or(path)
    };

    match AdminUIAssets::get(path) {
        Some(content) => {
            let mime_type = from_path(path).first_or_octet_stream();

            Ok(HttpResponse::Ok()
                .insert_header(("Cache-Control", "no-store, no-cache, must-revalidate"))
                .insert_header(("Pragma", "no-cache"))
                .insert_header(("Expires", "0"))
                .content_type(mime_type.as_ref())
                .body(content.data.into_owned()))
        }
        None => match AdminUIAssets::get("index.html") {
            Some(content) => Ok(HttpResponse::Ok()
                .insert_header(("Cache-Control", "no-store, no-cache, must-revalidate"))
                .insert_header(("Pragma", "no-cache"))
                .insert_header(("Expires", "0"))
                .content_type("text/html")
                .body(content.data.into_owned())),
            None => Ok(HttpResponse::NotFound()
                .insert_header(("Cache-Control", "no-store, no-cache, must-revalidate"))
                .insert_header(("Pragma", "no-cache"))
                .insert_header(("Expires", "0"))
                .body("Admin UI not found. Make sure the web UI has been built.")),
        },
    }
}

pub async fn redirect_to_admin() -> Result<HttpResponse> {
    Ok(HttpResponse::Found()
        .append_header(("Location", "/admin/"))
        .finish())
}
