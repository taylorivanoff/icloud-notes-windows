#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri_icloud_base::run(
        tauri_icloud_base::IcloudAppConfig {
            app_name: "iCloud Notes",
            url: "https://www.icloud.com/notes",
            remove_toolbar: false,
        },
        tauri::generate_context!(),
    );
}
