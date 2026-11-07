pub fn is_debug() -> bool {
    cfg!(debug_assertions)
}

pub fn get_version() -> &'static str {
    const VERSION: &str = env!("CARGO_PKG_VERSION");
    const GITHASH: &str = env!("GIT_COMMIT_HASH");
    const PLATFORM: &str = env!("BUILD_PLATFORM");
    const DEBUG: bool = cfg!(debug_assertions);

    let full_version = if DEBUG {
        format!("{}-{}-{}", VERSION, PLATFORM, GITHASH) // Arbiter 1.0.0-windows-1234567
    } else {
        format!("{}-{}", VERSION, PLATFORM) // Arbiter 1.0.0-windows
    };

    Box::leak(full_version.into_boxed_str())
}
