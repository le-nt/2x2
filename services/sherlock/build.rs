use std::process::Command;

fn main() {
    let git_hash = match get_git_hash() {
        Ok(hash) => hash,
        Err(_) => "unknown".to_string(),
    };

    println!("cargo:rustc-env=GIT_COMMIT_HASH={}", git_hash);

    let compile_date = chrono::Utc::now().to_rfc3339();
    println!("cargo:rustc-env=COMPILE_DATE={}", compile_date);
}

fn get_git_hash() -> Result<String, Box<dyn std::error::Error>> {
    let output = Command::new("git")
        .args(&["rev-parse", "--short", "HEAD"])
        .output()?;

    if !output.status.success() {
        return Err("Git command failed".into());
    }

    let git_hash = String::from_utf8(output.stdout)?;
    let git_hash = git_hash.trim();

    if git_hash.is_empty() {
        return Err("Empty git hash".into());
    }

    Ok(git_hash.to_string())
}
