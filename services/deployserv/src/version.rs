pub fn get_version() -> &'static str {
    const VERSION: &str = env!("CARGO_PKG_VERSION");
    const PLATFORM: &str = env!("BUILD_PLATFORM");
    const DEBUG: bool = cfg!(debug_assertions);
    const GITHASH: &str = env!("GIT_COMMIT_HASH");

    let full_version = format!(
        "v{}-{}-{}-{}",
        VERSION,
        PLATFORM,
        if DEBUG { "dbg" } else { "rel" },
        GITHASH
    );

    Box::leak(full_version.into_boxed_str())
}
