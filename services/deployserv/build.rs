use std::env;
use std::process::Command;

fn main() {
    println!("cargo:rerun-if-changed=.git/HEAD");
    println!("cargo:rerun-if-changed=.git/refs/heads");

    let output = Command::new("git")
        .args(&["rev-parse", "--short", "HEAD"])
        .output()
        .expect("Failed to get Git commit hash");

    let git_hash = String::from_utf8(output.stdout).unwrap();
    let git_hash = git_hash.trim();
    println!("cargo:rustc-env=GIT_COMMIT_HASH={}", git_hash);
    let target_os = env::var("CARGO_CFG_TARGET_OS").unwrap_or_else(|_| "unknown".into());
    println!("cargo:rustc-env=BUILD_PLATFORM={}", target_os);
}
