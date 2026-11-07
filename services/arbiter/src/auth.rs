use rocket::http::Status;
use rocket::request::{FromRequest, Outcome, Request};

pub struct AccessKey;

#[rocket::async_trait]
impl<'r> FromRequest<'r> for AccessKey {
    type Error = ();

    async fn from_request(req: &'r Request<'_>) -> Outcome<Self, Self::Error> {
        let provided = req.headers().get_one("AccessKey");

        let expected = match crate::cfg::get_config() {
            Ok(cfg) => cfg.access_key.as_str(),
            Err(_) => return Outcome::Error((Status::InternalServerError, ())),
        };

        match provided {
            Some(key) if key == expected => Outcome::Success(AccessKey),
            _ => Outcome::Error((Status::Unauthorized, ())),
        }
    }
}
