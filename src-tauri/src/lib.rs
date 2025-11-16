#[cfg(target_os = "android")]
use base64::engine::general_purpose::STANDARD;
#[cfg(target_os = "android")]
use base64::Engine;
use tauri_plugin_log::{Target, TargetKind};

#[tauri::command]
fn resolve_device_type() -> &'static str {
    if cfg!(any(target_os = "ios", target_os = "android")) {
        "mobile"
    } else {
        "desktop"
    }
}

#[cfg(target_os = "android")]
#[tauri::command]
async fn save_keystore_to_downloads_android(
    app: tauri::AppHandle,
    filename: String,
    mime: Option<String>,
    data_b64: String,
) -> Result<(), String> {
    use tauri_plugin_android_fs::{AndroidFsExt, PublicGeneralPurposeDir};

    let api = app.android_fs_async();
    let bytes = STANDARD.decode(data_b64).map_err(|e| e.to_string())?;
    api.public_storage()
        .write_new(
            None,
            PublicGeneralPurposeDir::Download,
            &filename,
            mime.as_deref(),
            &bytes,
        )
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
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

    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(log_plugin)
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_secure_storage::init());

    #[cfg(mobile)]
    let builder = builder
        .plugin(tauri_plugin_biometric::init())
        .plugin(tauri_plugin_safe_area_insets::init());

    #[cfg(target_os = "android")]
    let builder = builder.plugin(tauri_plugin_android_fs::init());

    #[cfg(target_os = "android")]
    builder
        .invoke_handler(tauri::generate_handler![
            resolve_device_type,
            save_keystore_to_downloads_android
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");

    #[cfg(not(target_os = "android"))]
    builder
        .invoke_handler(tauri::generate_handler![resolve_device_type])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
