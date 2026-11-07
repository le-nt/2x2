/*
 * This is SherlockCore, the fingerprinting library for Project Pizza.
 * We use it to discern who is using alt accounts, and analyze whether their
 * behaviour is an unfair advantage or used for malicious activities.
 *
 * The library aims to be tiny and easily bundled to builds of the website,
 * while staying non-intrusive and collecting minimal and anonymous data (I tried dude.)
 * :-)
 */

use sha2::{Digest, Sha256};
use std::collections::BTreeMap;
use wasm_bindgen::prelude::*;
use wasm_bindgen::JsCast;
use web_sys::{HtmlCanvasElement, WebGlRenderingContext};

#[wasm_bindgen(start)]
pub fn start() {
    console_error_panic_hook::set_once();
    let _ = console_log::init_with_level(log::Level::Info);
    log::warn!(
        "SherlockCore {} - built at {}",
        env!("GIT_COMMIT_HASH"),
        env!("COMPILE_DATE")
    );
}

/// Helper to *safely* extract a GL parameter. keyword *safely*
fn get_gl_param(gl: &WebGlRenderingContext, param: u32) -> Option<serde_json::Value> {
    match gl.get_parameter(param) {
        Ok(value) => {
            if value.is_null() || value.is_undefined() {
                return None;
            }

            if let Some(v) = value.as_f64() {
                return Some(serde_json::json!(v));
            }
            if let Some(v) = value.as_string() {
                return Some(serde_json::json!(v));
            }
            if let Some(v) = value.as_bool() {
                return Some(serde_json::json!(v));
            }

            if value.has_type::<js_sys::Int32Array>() {
                let arr: js_sys::Int32Array = value.unchecked_into();
                let vec: Vec<i32> = arr.to_vec();
                return Some(serde_json::json!(vec));
            }
            if value.has_type::<js_sys::Float32Array>() {
                let arr: js_sys::Float32Array = value.unchecked_into();
                let vec: Vec<f32> = arr.to_vec();
                return Some(serde_json::json!(vec));
            }

            None
        }
        Err(_) => None,
    }
}

#[wasm_bindgen]
pub async fn salam_aleykum() -> Result<JsValue, JsValue> {
    let window = web_sys::window().expect("no global `window` exists");
    let document = window.document().expect("should have a document on window");

    let origin = window.location().origin().unwrap_or_default();
    let report_url = format!("{}/api/sherlock/report", origin);
    let client = reqwest::Client::new();

    let canvas = match document.create_element("canvas") {
        Ok(el) => match el.dyn_into::<HtmlCanvasElement>() {
            Ok(c) => c,
            Err(_) => return Ok(JsValue::NULL),
        },
        Err(_) => return Ok(JsValue::NULL),
    };

    canvas.set_width(256);
    canvas.set_height(256);

    let gl = match canvas.get_context("webgl") {
        Ok(Some(ctx)) => match ctx.dyn_into::<WebGlRenderingContext>() {
            Ok(c) => c,
            Err(_) => return Ok(JsValue::NULL),
        },
        Ok(None) => {
            // Assume WebGL is disabled. This is strange - this is Project Pizza!
            log::error!("WebGL is disabled. This is REQUIRED to run Project Pizza!");
            let _ = client
                .post(&report_url)
                .header("Content-Type", "application/json")
                .body(
                    serde_json::json!({
                        "data": null,
                        "code": "tundra" // flag for 'no GL'
                    })
                    .to_string(),
                )
                .send()
                .await;
            return Ok(JsValue::NULL);
        }
        Err(e) => {
            log::error!("Error creating WebGL context: {:?}", e);
            return Ok(JsValue::NULL);
        }
    };

    let mut fp_map: BTreeMap<String, serde_json::Value> = BTreeMap::new();

    /*
     * 1. HARDWARE INFO
     */
    if let Some(v) = get_gl_param(&gl, WebGlRenderingContext::VENDOR) {
        fp_map.insert("vendor".to_string(), v.clone());
        fp_map.insert("unmasked_vendor".to_string(), v);
    }
    if let Some(v) = get_gl_param(&gl, WebGlRenderingContext::RENDERER) {
        fp_map.insert("renderer".to_string(), v.clone());
        fp_map.insert("unmasked_renderer".to_string(), v);
    }

    /*
     * 2. CORE PARAMS
     */
    let constants = [
        ("version", WebGlRenderingContext::VERSION),
        (
            "shading_lang_ver",
            WebGlRenderingContext::SHADING_LANGUAGE_VERSION,
        ),
        // vendor is already handled & mirrored
        (
            "max_vertex_attribs",
            WebGlRenderingContext::MAX_VERTEX_ATTRIBS,
        ),
        (
            "max_vertex_uniform_vec",
            WebGlRenderingContext::MAX_VERTEX_UNIFORM_VECTORS,
        ),
        (
            "max_vertex_tex_units",
            WebGlRenderingContext::MAX_VERTEX_TEXTURE_IMAGE_UNITS,
        ),
        (
            "max_varying_vec",
            WebGlRenderingContext::MAX_VARYING_VECTORS,
        ),
        (
            "aliased_line_width_range",
            WebGlRenderingContext::ALIASED_LINE_WIDTH_RANGE,
        ),
        (
            "aliased_point_size_range",
            WebGlRenderingContext::ALIASED_POINT_SIZE_RANGE,
        ),
        (
            "max_fragment_uniform_vec",
            WebGlRenderingContext::MAX_FRAGMENT_UNIFORM_VECTORS,
        ),
        (
            "max_tex_img_units",
            WebGlRenderingContext::MAX_TEXTURE_IMAGE_UNITS,
        ),
        (
            "max_renderbuffer_size",
            WebGlRenderingContext::MAX_RENDERBUFFER_SIZE,
        ),
        (
            "max_viewport_dims",
            WebGlRenderingContext::MAX_VIEWPORT_DIMS,
        ),
        ("red_bits", WebGlRenderingContext::RED_BITS),
        ("green_bits", WebGlRenderingContext::GREEN_BITS),
        ("blue_bits", WebGlRenderingContext::BLUE_BITS),
        ("alpha_bits", WebGlRenderingContext::ALPHA_BITS),
        ("depth_bits", WebGlRenderingContext::DEPTH_BITS),
        ("stencil_bits", WebGlRenderingContext::STENCIL_BITS),
        ("max_tex_size", WebGlRenderingContext::MAX_TEXTURE_SIZE),
        (
            "max_cube_map_tex_size",
            WebGlRenderingContext::MAX_CUBE_MAP_TEXTURE_SIZE,
        ),
        (
            "max_combined_tex_img_units",
            WebGlRenderingContext::MAX_COMBINED_TEXTURE_IMAGE_UNITS,
        ),
    ];

    for (key, param_id) in constants.iter() {
        if let Some(val) = get_gl_param(&gl, *param_id) {
            fp_map.insert((*key).to_string(), val);
        }
    }

    /*
     * 3. CONTEXT ATTRIBUTES
     */
    if let Some(attrs) = gl.get_context_attributes() {
        let get_attr = |name: &str| -> Option<bool> {
            js_sys::Reflect::get(&attrs, &JsValue::from_str(name))
                .ok()
                .and_then(|v| v.as_bool())
        };

        if let Some(v) = get_attr("alpha") {
            fp_map.insert("attr_alpha".to_string(), serde_json::json!(v));
        }
        if let Some(v) = get_attr("antialias") {
            fp_map.insert("attr_antialias".to_string(), serde_json::json!(v));
        }
        if let Some(v) = get_attr("depth") {
            fp_map.insert("attr_depth".to_string(), serde_json::json!(v));
        }
        if let Some(v) = get_attr("stencil") {
            fp_map.insert("attr_stencil".to_string(), serde_json::json!(v));
        }
        if let Some(v) = get_attr("premultipliedAlpha") {
            fp_map.insert("attr_premultipliedAlpha".to_string(), serde_json::json!(v));
        }
        if let Some(v) = get_attr("preserveDrawingBuffer") {
            fp_map.insert(
                "attr_preserveDrawingBuffer".to_string(),
                serde_json::json!(v),
            );
        }
    }

    /*
     * 4. EXTENSIONS
     * see which extensions are supported on the specific hardware here
     * helps us narrow down
     */
    if let Some(ext_list) = gl.get_supported_extensions() {
        let mut extensions: Vec<String> = ext_list
            .iter()
            .map(|e| e.as_string().unwrap_or_default())
            .collect();
        extensions.sort();

        if !extensions.is_empty() {
            fp_map.insert(
                "extensions".to_string(),
                serde_json::json!(extensions.clone()),
            );
        }

        /* ensure extension is actually enabled before getting const,
         * obtain MAX_TEXTURE_MAX_ANISOTROPY_EXT const from the extension obj
         */
        let anisotropy_names = [
            "EXT_texture_filter_anisotropic",
            "MOZ_EXT_texture_filter_anisotropic",
            "WEBKIT_EXT_texture_filter_anisotropic",
        ];
        let mut anisotropy_constant: Option<u32> = None;
        let anisotropy_enabled = anisotropy_names.iter().any(|name| {
            if let Ok(Some(obj)) = gl.get_extension(name) {
                if anisotropy_constant.is_none() {
                    anisotropy_constant = js_sys::Reflect::get(
                        &obj,
                        &JsValue::from_str("MAX_TEXTURE_MAX_ANISOTROPY_EXT"),
                    )
                    .ok()
                    .and_then(|v| v.as_f64().map(|num| num as u32));
                }
                true
            } else {
                false
            }
        });
        // This is only a fallback btw if we use this we shouldn't trust it particularly
        let anisotropy_constant = anisotropy_constant.unwrap_or(0x84FF);

        if anisotropy_enabled {
            if let Some(val) = get_gl_param(&gl, anisotropy_constant) {
                fp_map.insert("max_anisotropy".to_string(), val);
            }
        }
    }

    /*
     * 5. RENDERING TESTS
     * we aim to identify rounding errors on the specific hardware here
     */
    gl.clear_color(0.123456789, 0.3456789, 0.567890123, 1.0);
    gl.clear(WebGlRenderingContext::COLOR_BUFFER_BIT);

    match canvas.to_data_url() {
        Ok(url) => {
            fp_map.insert("canvas_image".to_string(), serde_json::json!(url));
        }
        Err(_) => {
            log::warn!("Could not export canvas image");
        }
    }

    /*
     * 6. FINALIZING
     */
    let json_report = match serde_json::to_string(&fp_map) {
        Ok(s) => s,
        Err(_) => return Err(JsValue::from_str("Failed to serialize fingerprint map")),
    };

    let mut hasher = Sha256::new();
    hasher.update(json_report);
    let result = hasher.finalize();
    let final_hash = hex::encode(result);

    let _ = client
        .post(&report_url)
        .header("Content-Type", "application/json")
        .body(
            serde_json::json!({
                "data": final_hash
            })
            .to_string(),
        )
        .send()
        .await;

    Ok(JsValue::NULL)
}
