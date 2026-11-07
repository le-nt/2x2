mod api;
mod app;
mod auth;
mod components;

#[cfg(target_arch = "wasm32")]
use wasm_bindgen::prelude::*;

#[cfg(target_arch = "wasm32")]
use web_sys::wasm_bindgen::JsCast;

#[cfg(target_arch = "wasm32")]
fn console_log_js(s: &str) {
    web_sys::console::log_1(&s.into());
}

#[macro_export]
macro_rules! console_log {
    ( $( $t:tt )* ) => {
        #[cfg(target_arch = "wasm32")]
        crate::console_log_js(&format!( $( $t )* ));
        #[cfg(not(target_arch = "wasm32"))]
        println!( $( $t )* );
    }
}

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen]
pub fn start_app() {
    console_error_panic_hook::set_once();

    let web_options = eframe::WebOptions::default();

    wasm_bindgen_futures::spawn_local(async {
        let document = web_sys::window()
            .expect("No global `window` exists")
            .document()
            .expect("Should have a document on window");

        let canvas = document
            .get_element_by_id("admin-ui")
            .expect("Should have an element with id 'admin-ui'")
            .dyn_into::<web_sys::HtmlCanvasElement>()
            .expect("Element should be a canvas");

        if let Err(e) = eframe::WebRunner::new()
            .start(
                canvas,
                web_options,
                Box::new(|cc| Ok(Box::new(app::AdminApp::new(cc)))),
            )
            .await
        {
            console_log_js(&format!("Failed to start eframe: {:?}", e));
        }
    });
}
