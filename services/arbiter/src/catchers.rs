use crate::responses;
use rocket::{catch, catchers, serde::json::Json};

#[catch(404)]
#[allow(non_snake_case, dead_code)]
fn NotFound() -> Json<responses::Response> {
    Json(responses::Response {
        success: false,
        message: "Not Found"
    })
}

pub fn all() -> Vec<rocket::Catcher> {
    catchers![NotFound]
}