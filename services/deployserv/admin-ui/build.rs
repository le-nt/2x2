use std::env;
use std::path::Path;
use std::process::Command;

fn main() {
    println!("cargo:rerun-if-changed=src");
    println!("cargo:rerun-if-changed=index.html");
    println!("cargo:rerun-if-changed=build.rs");

    let target = env::var("TARGET").unwrap_or_default();
    let profile = env::var("PROFILE").unwrap_or_else(|_| "debug".to_string());

    if target.starts_with("wasm32") {
        println!(
            "cargo:warning=Building admin-ui for WebAssembly target: {} (profile: {})",
            target, profile
        );
    }
}

#[allow(dead_code)]
fn build_wasm_bindgen() -> Result<(), Box<dyn std::error::Error>> {
    println!("Running wasm-bindgen...");

    let profile = env::var("PROFILE").unwrap_or_else(|_| "debug".to_string());
    let is_release = profile == "release";

    let wasm_file_path = if is_release {
        "../target/wasm32-unknown-unknown/release/admin_ui.wasm"
    } else {
        "../target/wasm32-unknown-unknown/debug/admin_ui.wasm"
    };

    println!("Using wasm file: {}", wasm_file_path);
    println!("Build profile: {}", profile);

    if !Path::new(wasm_file_path).exists() {
        return Err(format!("WASM file not found at {}", wasm_file_path).into());
    }

    println!("Generating JavaScript bindings...");
    let wasm_bindgen_output = Command::new("wasm-bindgen")
        .args(&[
            "--out-dir",
            "dist",
            "--target",
            "web",
            "--no-typescript",
            wasm_file_path,
        ])
        .output();

    match wasm_bindgen_output {
        Ok(output) if output.status.success() => {
            println!("JavaScript bindings generated successfully!");
        }
        Ok(output) => {
            eprintln!("wasm-bindgen failed:");
            eprintln!("{}", String::from_utf8_lossy(&output.stderr));
            eprintln!("Note: Make sure wasm-bindgen is installed: cargo install wasm-bindgen-cli");
            return Err("wasm-bindgen failed".into());
        }
        Err(e) => {
            eprintln!("Failed to run wasm-bindgen: {}", e);
            eprintln!("Note: Make sure wasm-bindgen is installed: cargo install wasm-bindgen-cli");
            return Err("Failed to run wasm-bindgen".into());
        }
    }

    let index_src = Path::new("index.html");
    let index_dst = Path::new("dist/index.html");
    if index_src.exists() {
        std::fs::create_dir_all("dist")?;
        std::fs::copy(index_src, index_dst)?;
        println!("Copied index.html to dist/");
    } else {
        println!("Warning: index.html not found at admin-ui/index.html");
    }

    println!("wasm-bindgen complete! Check the admin-ui/dist/ directory for output files.");
    Ok(())
}
