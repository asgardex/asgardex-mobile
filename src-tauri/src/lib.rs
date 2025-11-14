use tauri_plugin_log::{Target, TargetKind};

#[tauri::command]
fn resolve_device_type() -> &'static str {
    if cfg!(any(target_os = "ios", target_os = "android")) {
        "mobile"
    } else {
        "desktop"
    }
}

pub fn run() {
    let mut log_targets = vec![
        Target::new(TargetKind::Stdout),
        Target::new(TargetKind::LogDir { file_name: None }),
    ];

    if std::env::var("ASGARDEX_LOG_TO_WEBVIEW")
        .ok()
        .as_deref()
        == Some("true")
    {
        log_targets.push(Target::new(TargetKind::Webview));
    }

    let log_plugin = tauri_plugin_log::Builder::default()
        .level(log::LevelFilter::Info)
        .targets(log_targets)
        .build();

    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(log_plugin)
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_secure_storage::init());

    #[cfg(mobile)]
    {
        builder = builder.plugin(tauri_plugin_biometric::init());
    }

    builder
        .invoke_handler(tauri::generate_handler![resolve_device_type])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
