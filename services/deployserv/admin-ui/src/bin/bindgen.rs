use std::env;
use std::path::Path;
use std::process::Command;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<String> = env::args().collect();
    let profile = args.get(1).map(|s| s.as_str()).unwrap_or("release");

    println!("Running wasm-bindgen for profile: {}", profile);

    let is_release = profile == "release";

    let wasm_file_path = if is_release {
        "../target/wasm32-unknown-unknown/release/admin_ui.wasm"
    } else {
        "../target/wasm32-unknown-unknown/debug/admin_ui.wasm"
    };

    println!("Using wasm file: {}", wasm_file_path);

    if !Path::new(wasm_file_path).exists() {
        return Err(
            format!(
                "WASM file not found at {}. Please build the wasm target first with:\ncargo build --target wasm32-unknown-unknown {}",
                wasm_file_path,
                if is_release {
                    "--release"
                } else {
                    ""
                }
            ).into()
        );
    }

    std::fs::create_dir_all("dist")?;

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
        std::fs::copy(index_src, index_dst)?;
        println!("Copied index.html to dist/");
    } else {
        println!("Warning: index.html not found at admin-ui/index.html");
    }

    println!("\nwasm-bindgen complete! Files generated in admin-ui/dist/:");
    if let Ok(entries) = std::fs::read_dir("dist") {
        for entry in entries.flatten() {
            if let Some(name) = entry.file_name().to_str() {
                println!("  - {}", name);
            }
        }
    }

    Ok(())
}
