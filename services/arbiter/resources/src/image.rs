use serde::{Deserialize, Serialize};
use std::fmt;

#[derive(Serialize, Deserialize, Clone, Copy)]
pub enum ImageFormat {
    Jpeg,
    Png,
    Bmap, // Bmp,
}

impl fmt::Display for ImageFormat {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            ImageFormat::Jpeg => write!(f, "JPEG"),
            ImageFormat::Png => write!(f, "PNG"),
            ImageFormat::Bmap => write!(f, "BMP"),
        }
    }
}