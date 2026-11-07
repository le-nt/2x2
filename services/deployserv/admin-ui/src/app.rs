use crate::api;
use crate::auth::AuthState;
use crate::components::{
    ApiKeyAction, ApiKeyManagementComponent, AppAction, AppManagementComponent, ChannelAction,
    ChannelManagementComponent, DeploymentAction, DeploymentManagementComponent,
    FileUploadComponent, UploadAction,
};
use egui::Color32;
use serde::{Deserialize, Serialize};

use crate::console_log;

#[derive(serde::Deserialize, serde::Serialize)]
#[serde(default)]
pub struct AdminApp {
    auth_state: AuthState,
    current_tab: AppTab,

    last_tab: Option<AppTab>,

    login_api_key: String,

    api_key_component: ApiKeyManagementComponent,
    app_component: AppManagementComponent,
    upload_component: FileUploadComponent,
    channel_component: ChannelManagementComponent,
    deployment_component: DeploymentManagementComponent,

    authenticating: bool,
    login_error: Option<String>,

    auto_attempted_api_keys: bool,
    auto_attempted_apps: bool,
    auto_attempted_channels: bool,
    auto_attempted_deployments: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
enum AppTab {
    Login,
    Dashboard,
    ApiKeys,
    Apps,
    Channels,
    Deployments,
    Upload,
}

impl Default for AppTab {
    fn default() -> Self {
        AppTab::Login
    }
}

impl Default for AdminApp {
    fn default() -> Self {
        Self {
            auth_state: AuthState::new(),
            current_tab: AppTab::Login,
            last_tab: None,
            login_api_key: String::new(),
            api_key_component: ApiKeyManagementComponent::default(),
            app_component: AppManagementComponent::default(),
            upload_component: FileUploadComponent::default(),
            channel_component: ChannelManagementComponent::default(),
            deployment_component: DeploymentManagementComponent::default(),
            authenticating: false,
            login_error: None,
            auto_attempted_api_keys: false,
            auto_attempted_apps: false,
            auto_attempted_channels: false,
            auto_attempted_deployments: false,
        }
    }
}

impl AdminApp {
    pub fn new(cc: &eframe::CreationContext<'_>) -> Self {
        if let Some(storage) = cc.storage {
            return eframe::get_value(storage, eframe::APP_KEY).unwrap_or_default();
        }

        Default::default()
    }

    fn login_ui(&mut self, ui: &mut egui::Ui) {
        ui.vertical_centered(|ui| {
            ui.add_space(50.0);
            ui.heading("Please login");
            ui.add_space(30.0);

            if let Some(ref error) = self.login_error {
                ui.colored_label(Color32::RED, format!("❌ {}", error));
                ui.add_space(10.0);
            }

            ui.group(|ui| {
                ui.vertical(|ui| {
                    ui.set_width(400.0);

                    ui.label("🔑 ACL:");
                    let api_key_response = ui.add(
                        egui::TextEdit::singleline(&mut self.login_api_key)
                            .password(true)
                            .hint_text("Enter your ACL...")
                            .desired_width(300.0),
                    );
                    ui.add_space(20.0);

                    ui.horizontal(|ui| {
                        let login_button = ui.add_enabled(
                            !self.authenticating && !self.login_api_key.is_empty(),
                            egui::Button::new("🔓 Login")
                                .min_size(egui::vec2(120.0, 40.0))
                                .fill(Color32::from_rgb(100, 149, 237)),
                        );
                        if self.authenticating {
                            ui.spinner();
                            ui.label("Authenticating...");
                        }
                        if login_button.clicked()
                            || (api_key_response.lost_focus()
                                && ui.input(|i| i.key_pressed(egui::Key::Enter)))
                        {
                            self.start_login();
                        }
                    });
                });
            });
        });
    }

    fn start_login(&mut self) {
        if self.login_api_key.is_empty() || self.authenticating {
            return;
        }

        #[cfg(target_arch = "wasm32")]
        let base_url = {
            use web_sys::wasm_bindgen::JsCast;
            let window = web_sys::window().expect("no global window");
            let location = window.location();
            let origin = location
                .origin()
                .unwrap_or_else(|_| "http://localhost:8080".to_string());
            origin
        };

        #[cfg(not(target_arch = "wasm32"))]
        let base_url = "http://localhost:8080".to_string();

        self.auth_state.set_api_key(self.login_api_key.clone());
        self.auth_state.set_base_url(base_url.clone());
        self.authenticating = true;
        self.login_error = None;
        console_log!("Attempt login to {}", base_url);
        #[cfg(target_arch = "wasm32")]
        {
            use crate::console_log;
            let api_key_cl = self.login_api_key.clone();
            let base_url_cl = base_url.clone();
            use std::cell::RefCell;
            use std::rc::Rc;
            let app_ptr: Rc<RefCell<*mut AdminApp>> = Rc::new(RefCell::new(self as *mut _));
            let app_ptr_clone = app_ptr.clone();
            wasm_bindgen_futures::spawn_local(async move {
                let result = api::verify_api_key(&api_key_cl, &base_url_cl).await;
                let raw = *app_ptr_clone.borrow();
                unsafe {
                    if let Some(app) = raw.as_mut() {
                        match result {
                            Ok(info) => {
                                console_log!(
                                    "Login success role={} override={} privs={}",
                                    info.role,
                                    info.is_override,
                                    info.privileges.len()
                                );
                                if info.role == "guest" {
                                    app.login_error = Some("Bad ACL!".to_string());
                                    app.auth_state.logout();
                                    app.authenticating = false;
                                } else {
                                    app.auth_state.authenticate(info);
                                    app.current_tab = AppTab::Dashboard;
                                    app.authenticating = false;
                                    app.auto_attempted_api_keys = false;
                                    app.auto_attempted_apps = false;
                                    app.auto_attempted_channels = false;
                                    app.auto_attempted_deployments = false;
                                }
                            }
                            Err(e) => {
                                console_log!("Login failed: {}", e);
                                app.login_error = Some(e);
                                app.auth_state.logout();
                                app.authenticating = false;
                            }
                        }
                    }
                }
            });
        }
        #[cfg(not(target_arch = "wasm32"))]
        {
            self.login_error = Some("Native login not implemented (run in browser)".to_string());
            self.authenticating = false;
        }
    }

    fn dashboard_ui(&mut self, ui: &mut egui::Ui) {
        ui.heading("Dashboard");
        ui.separator();

        if let Some(ref user_info) = self.auth_state.user_info {
            ui.group(|ui| {
                ui.vertical(|ui| {
                    ui.label(format!("👤 Role: {}", user_info.role));
                    ui.label(format!(
                        "🔑 Override: {}",
                        if user_info.is_override { "Yes" } else { "No" }
                    ));
                    ui.label(format!("🌐 Server: {}", self.auth_state.base_url));
                    ui.label(format!(
                        "🔐 Privileges: {}",
                        user_info.privileges.join(", ")
                    ));
                });
            });
        }

        ui.add_space(20.0);

        ui.group(|ui| {
            ui.vertical(|ui| {
                ui.heading("Quick Actions");
                ui.horizontal(|ui| {
                    if ui.button("🔑 Manage API Keys").clicked() {
                        self.current_tab = AppTab::ApiKeys;
                    }
                    if ui.button("📱 View Apps").clicked() {
                        self.current_tab = AppTab::Apps;
                    }
                    if ui.button("📦 Upload Bundle").clicked() {
                        self.current_tab = AppTab::Upload;
                    }
                });
            });
        });
    }

    fn top_panel(&mut self, ctx: &egui::Context) {
        egui::TopBottomPanel::top("top_panel").show(ctx, |ui| {
            ui.horizontal(|ui| {
                ui.heading("Deployments Management Service");

                ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                    if self.auth_state.is_authenticated {
                        if ui.button("Logout").clicked() {
                            self.logout();
                        }

                        ui.separator();

                        if let Some(ref user_info) = self.auth_state.user_info {
                            ui.label(format!("Permission: {}", user_info.role));
                        }
                    }
                });
            });
        });

        if self.auth_state.is_authenticated {
            egui::TopBottomPanel::top("tab_panel").show(ctx, |ui| {
                ui.horizontal(|ui| {
                    ui.selectable_value(&mut self.current_tab, AppTab::Dashboard, "📊 Dashboard");

                    if self.auth_state.is_admin() {
                        ui.selectable_value(&mut self.current_tab, AppTab::ApiKeys, "🔑 API Keys");
                    }

                    if self.auth_state.can_read_apps() {
                        ui.selectable_value(&mut self.current_tab, AppTab::Apps, "📱 Apps");
                    }

                    if self.auth_state.can_read_channels() {
                        ui.selectable_value(&mut self.current_tab, AppTab::Channels, "📡 Channels");
                    }

                    if self.auth_state.can_read_deployments() {
                        ui.selectable_value(
                            &mut self.current_tab,
                            AppTab::Deployments,
                            "📦 Deployments",
                        );
                    }

                    if self.auth_state.can_write_deployments() {
                        ui.selectable_value(&mut self.current_tab, AppTab::Upload, "📦 Upload");
                    }
                });
            });
        }
    }

    fn logout(&mut self) {
        self.auth_state.logout();
        self.current_tab = AppTab::Login;
        self.last_tab = None;
        self.login_api_key.clear();
        self.login_error = None;
        self.authenticating = false;

        self.api_key_component = ApiKeyManagementComponent::default();
        self.app_component = AppManagementComponent::default();
        self.upload_component = FileUploadComponent::default();
        self.channel_component = ChannelManagementComponent::default();
        self.deployment_component = DeploymentManagementComponent::default();
    }
}

impl eframe::App for AdminApp {
    fn save(&mut self, storage: &mut dyn eframe::Storage) {
        eframe::set_value(storage, eframe::APP_KEY, self);
    }

    fn update(&mut self, ctx: &egui::Context, _frame: &mut eframe::Frame) {
        #[cfg(target_arch = "wasm32")]
        {
            use std::cell::RefCell;
            use wasm_bindgen::JsValue;
            thread_local! { static FRAME_COUNT: RefCell<u64> = RefCell::new(0); }
            FRAME_COUNT.with(|c| {
                let mut v = c.borrow_mut();
                *v += 1;
                if *v % 300 == 1 {
                    // ! Lu tollu ci 300 kadre?
                    crate::console_log!("FRAME_COUNTER {}", *v);
                }
            });
        }
        // * we dont need to poll WOWIE
        self.top_panel(ctx);

        egui::CentralPanel::default().show(ctx, |ui| {
            if !self.auth_state.is_authenticated {
                self.login_ui(ui);
                return;
            }

            // ! GOD THIS IS DOOHICKEY
            let tab_changed = self.last_tab.as_ref() != Some(&self.current_tab);
            let first_visit = self.last_tab.is_none();
            if tab_changed || first_visit {
                match self.current_tab {
                    AppTab::ApiKeys => {
                        self.auto_attempted_api_keys = false;
                        console_log!(
                            "[auto] Entering API Keys tab (changed: {}, first: {})",
                            tab_changed,
                            first_visit
                        );
                    }
                    AppTab::Apps => {
                        self.auto_attempted_apps = false;
                        console_log!(
                            "[auto] Entering Apps tab (changed: {}, first: {})",
                            tab_changed,
                            first_visit
                        );
                    }
                    AppTab::Channels => {
                        self.auto_attempted_channels = false;
                        console_log!(
                            "[auto] Entering Channels tab (changed: {}, first: {})",
                            tab_changed,
                            first_visit
                        );
                    }
                    AppTab::Deployments => {
                        self.auto_attempted_deployments = false;
                        console_log!(
                            "[auto] Entering Deployments tab (changed: {}, first: {})",
                            tab_changed,
                            first_visit
                        );
                    }
                    _ => {}
                }
            }

            match self.current_tab {
                AppTab::Login => self.login_ui(ui),
                AppTab::Dashboard => self.dashboard_ui(ui),
                AppTab::ApiKeys => {
                    // ! prechargement merde
                    if (tab_changed || first_visit)
                        && self.auth_state.is_admin()
                        && !self.auto_attempted_api_keys
                        && !self.api_key_component.loading
                    {
                        console_log!("[auto] Triggering API keys auto-refresh");
                        self.auto_attempted_api_keys = true;
                        self.handle_api_key_action(ApiKeyAction::Refresh);
                    }
                    if self.auth_state.is_admin() {
                        if let Some(action) = self.api_key_component.ui(ui) {
                            self.handle_api_key_action(action);
                        }
                    } else {
                        ui.label("Access denied");
                    }
                }
                AppTab::Apps => {
                    if (tab_changed || first_visit)
                        && !self.auto_attempted_apps
                        && !self.app_component.loading
                    {
                        console_log!("[auto] Triggering apps auto-refresh");
                        self.auto_attempted_apps = true;
                        self.handle_app_action(AppAction::Refresh);
                    }
                    if let Some(action) = self.app_component.ui(ui) {
                        self.handle_app_action(action);
                    }
                }
                AppTab::Channels => {
                    if (tab_changed || first_visit)
                        && !self.auto_attempted_apps
                        && !self.app_component.loading
                    {
                        // ! jefandikuwaat jefandikukaay jeem sa bopp bandera ak chaine yi aju ci limu jefandikukaay yi
                        console_log!("[auto] Triggering apps auto-refresh for channels");
                        self.auto_attempted_apps = true;
                        self.handle_app_action(AppAction::Refresh);
                    }
                    if let Some(action) = self.channel_component.ui(ui, &self.app_component.apps) {
                        self.handle_channel_action(action);
                    }
                }
                AppTab::Deployments => {
                    if self.auth_state.can_read_deployments() {
                        if ((tab_changed || first_visit)
                            || self.deployment_component.needs_initial_load)
                            && !self.auto_attempted_deployments
                            && !self.deployment_component.loading
                        {
                            self.deployment_component.needs_initial_load = false; // consume lazy flag if set
                            console_log!("[auto] Triggering deployments auto-refresh");
                            self.auto_attempted_deployments = true;
                            let app_filter = if self.deployment_component.filter_app.is_empty() {
                                None
                            } else {
                                Some(self.deployment_component.filter_app.clone())
                            };
                            let channel_filter =
                                if self.deployment_component.filter_channel.is_empty() {
                                    None
                                } else {
                                    Some(self.deployment_component.filter_channel.clone())
                                };
                            self.handle_deployment_action(DeploymentAction::Load {
                                app: app_filter,
                                channel: channel_filter,
                            });
                        }
                        if let Some(action) =
                            self.deployment_component.ui(ui, &self.app_component.apps)
                        {
                            self.handle_deployment_action(action);
                        }
                    } else {
                        ui.label("Access denied");
                    }
                }
                AppTab::Upload => {
                    if let Some(action) = self.upload_component.ui(ui) {
                        self.handle_upload_action(action);
                    }
                }
            }

            self.last_tab = Some(self.current_tab.clone());
        });
    }
}

impl AdminApp {
    fn handle_api_key_action(&mut self, action: ApiKeyAction) {
        match action {
            ApiKeyAction::Create(role) => {
                console_log!("[ApiKeys] Creating API key with role: {}", role);
                self.api_key_component.set_loading(true);

                if let Some(ref _user_info) = self.auth_state.user_info {
                    let mut client = api::ApiClient::new(self.auth_state.base_url.clone());
                    client.set_api_key(self.auth_state.api_key.clone());
                    let component_ptr: *mut ApiKeyManagementComponent =
                        &mut self.api_key_component as *mut _;
                    let role_clone = role.clone();

                    #[cfg(target_arch = "wasm32")]
                    {
                        wasm_bindgen_futures::spawn_local(async move {
                            crate::console_log!("[ApiKeys] create_api_key request dispatched");
                            let result = client.create_api_key(&role_clone).await;
                            unsafe {
                                if let Some(component) = component_ptr.as_mut() {
                                    match result {
                                        Ok(created_key) => {
                                            component.set_created_key(created_key);
                                            component.set_success(
                                                "API key created successfully!".to_string(),
                                            );
                                        }
                                        Err(e) => {
                                            component.set_error(format!(
                                                "Failed to create API key: {}",
                                                e
                                            ));
                                        }
                                    }
                                    component.set_loading(false);
                                }
                            }
                        });
                    }
                    #[cfg(not(target_arch = "wasm32"))]
                    {
                        self.api_key_component
                            .set_error("API operations not supported in native mode".to_string());
                        self.api_key_component.set_loading(false);
                    }
                } else {
                    self.api_key_component
                        .set_error("Not authenticated".to_string());
                    self.api_key_component.set_loading(false);
                }
            }
            ApiKeyAction::Delete(id) => {
                console_log!("Deleting API key: {}", id);
                self.api_key_component.set_loading(true);

                if let Some(ref _user_info) = self.auth_state.user_info {
                    let mut client = api::ApiClient::new(self.auth_state.base_url.clone());
                    client.set_api_key(self.auth_state.api_key.clone());

                    let component_ptr: *mut ApiKeyManagementComponent =
                        &mut self.api_key_component as *mut _;
                    let id_clone = id.clone();

                    #[cfg(target_arch = "wasm32")]
                    {
                        wasm_bindgen_futures::spawn_local(async move {
                            let result = client.delete_api_key(&id_clone).await;
                            let delete_key = format!("delete_{}", id_clone);
                            unsafe {
                                if let Some(component) = component_ptr.as_mut() {
                                    component.clear_processing_operation(&delete_key);
                                    match result {
                                        Ok(_) => {
                                            component.set_success(format!(
                                                "API key {} deleted successfully",
                                                id_clone
                                            ));
                                            // !!!WERSEGU JAMM
                                            // redessin bu sell!!
                                            let refresh_result = client.get_api_keys().await;
                                            match refresh_result {
                                                Ok(api_keys) => {
                                                    component.set_api_keys(api_keys);
                                                }
                                                Err(e) => {
                                                    component.set_error(format!("Failed to refresh API keys after deletion: {}", e));
                                                }
                                            }
                                        }
                                        Err(e) => {
                                            component.set_error(format!(
                                                "Failed to delete API key: {}",
                                                e
                                            ));
                                        }
                                    }
                                    component.set_loading(false);
                                }
                            }
                        });
                    }

                    #[cfg(not(target_arch = "wasm32"))]
                    {
                        self.api_key_component
                            .clear_processing_operation(&format!("delete_{}", id));
                        self.api_key_component
                            .set_error("API operations not supported in native mode".to_string());
                        self.api_key_component.set_loading(false);
                    }
                } else {
                    self.api_key_component
                        .clear_processing_operation(&format!("delete_{}", id));
                    self.api_key_component
                        .set_error("Not authenticated".to_string());
                    self.api_key_component.set_loading(false);
                }
            }
            ApiKeyAction::Toggle(id) => {
                console_log!("Toggling API key: {}", id);
                self.api_key_component.set_loading(true);

                if let Some(ref _user_info) = self.auth_state.user_info {
                    let mut client = api::ApiClient::new(self.auth_state.base_url.clone());
                    client.set_api_key(self.auth_state.api_key.clone());

                    let component_ptr: *mut ApiKeyManagementComponent =
                        &mut self.api_key_component as *mut _;
                    let id_clone = id.clone();

                    #[cfg(target_arch = "wasm32")]
                    {
                        wasm_bindgen_futures::spawn_local(async move {
                            let result = client.toggle_api_key(&id_clone).await;
                            let toggle_key = format!("toggle_{}", id_clone);
                            unsafe {
                                if let Some(component) = component_ptr.as_mut() {
                                    component.clear_processing_operation(&toggle_key);
                                    match result {
                                        Ok(_) => {
                                            component.set_success(format!(
                                                "API key {} status toggled successfully",
                                                id_clone
                                            ));
                                            // Refresgh
                                            let refresh_result = client.get_api_keys().await;
                                            match refresh_result {
                                                Ok(api_keys) => {
                                                    component.set_api_keys(api_keys);
                                                }
                                                Err(e) => {
                                                    component.set_error(format!("Failed to refresh API keys after toggle: {}", e));
                                                }
                                            }
                                        }
                                        Err(e) => {
                                            component.set_error(format!(
                                                "Failed to toggle API key: {}",
                                                e
                                            ));
                                        }
                                    }
                                    component.set_loading(false);
                                }
                            }
                        });
                    }

                    #[cfg(not(target_arch = "wasm32"))]
                    {
                        self.api_key_component
                            .clear_processing_operation(&format!("toggle_{}", id));
                        self.api_key_component
                            .set_error("API operations not supported in native mode".to_string());
                        self.api_key_component.set_loading(false);
                    }
                } else {
                    self.api_key_component
                        .clear_processing_operation(&format!("toggle_{}", id));
                    self.api_key_component
                        .set_error("Not authenticated".to_string());
                    self.api_key_component.set_loading(false);
                }
            }
            ApiKeyAction::Refresh => {
                console_log!("Refreshing API keys");
                self.api_key_component.set_loading(true);

                if let Some(ref _user_info) = self.auth_state.user_info {
                    let mut client = api::ApiClient::new(self.auth_state.base_url.clone());
                    client.set_api_key(self.auth_state.api_key.clone());

                    let component_ptr: *mut ApiKeyManagementComponent =
                        &mut self.api_key_component as *mut _;

                    #[cfg(target_arch = "wasm32")]
                    {
                        wasm_bindgen_futures::spawn_local(async move {
                            let result = client.get_api_keys().await;
                            unsafe {
                                if let Some(component) = component_ptr.as_mut() {
                                    match result {
                                        Ok(api_keys) => {
                                            component.set_api_keys(api_keys);
                                        }
                                        Err(e) => {
                                            component.set_error(format!(
                                                "Failed to fetch API keys: {}",
                                                e
                                            ));
                                        }
                                    }
                                    component.set_loading(false);
                                }
                            }
                        });
                    }

                    #[cfg(not(target_arch = "wasm32"))]
                    {
                        self.api_key_component
                            .set_error("API operations not supported in native mode".to_string());
                        self.api_key_component.set_loading(false);
                    }
                } else {
                    self.api_key_component
                        .set_error("Not authenticated".to_string());
                    self.api_key_component.set_loading(false);
                }
            }
        }
    }

    fn handle_app_action(&mut self, action: AppAction) {
        match action {
            AppAction::Refresh => {
                console_log!("Refreshing apps");
                self.app_component.set_loading(true);

                if let Some(ref _user_info) = self.auth_state.user_info {
                    let mut client = api::ApiClient::new(self.auth_state.base_url.clone());
                    client.set_api_key(self.auth_state.api_key.clone());

                    let component_ptr: *mut AppManagementComponent =
                        &mut self.app_component as *mut _;

                    #[cfg(target_arch = "wasm32")]
                    {
                        wasm_bindgen_futures::spawn_local(async move {
                            let result = client.get_apps().await;
                            unsafe {
                                if let Some(component) = component_ptr.as_mut() {
                                    match result {
                                        Ok(apps) => {
                                            component.set_apps(apps);
                                        }
                                        Err(e) => {
                                            component
                                                .set_error(format!("Failed to fetch apps: {}", e));
                                        }
                                    }
                                    component.set_loading(false);
                                    component.clear_processing_operation("refresh_apps");
                                }
                            }
                        });
                    }

                    #[cfg(not(target_arch = "wasm32"))]
                    {
                        self.app_component
                            .set_error("API operations not supported in native mode".to_string());
                        self.app_component.set_loading(false);
                        self.app_component
                            .clear_processing_operation("refresh_apps");
                    }
                } else {
                    self.app_component
                        .set_error("Not authenticated".to_string());
                    self.app_component.set_loading(false);
                    self.app_component
                        .clear_processing_operation("refresh_apps");
                }
            }
            AppAction::Create(app_name) => {
                console_log!("Creating app: {}", app_name);
                self.app_component.set_loading(true);

                if let Some(ref _user_info) = self.auth_state.user_info {
                    let mut client = api::ApiClient::new(self.auth_state.base_url.clone());
                    client.set_api_key(self.auth_state.api_key.clone());

                    let component_ptr: *mut AppManagementComponent =
                        &mut self.app_component as *mut _;
                    let app_name_clone = app_name.clone();

                    #[cfg(target_arch = "wasm32")]
                    {
                        wasm_bindgen_futures::spawn_local(async move {
                            let result = client.create_app(&app_name_clone).await;
                            unsafe {
                                if let Some(component) = component_ptr.as_mut() {
                                    component.clear_processing_operation("create_app");
                                    match result {
                                        Ok(_) => {
                                            component.set_success(format!(
                                                "App '{}' created successfully",
                                                app_name_clone
                                            ));
                                            component.clear_new_app_name();
                                            let mut new_list = component.apps.clone();
                                            new_list.push(crate::api::App {
                                                id: "(pending)".to_string(),
                                                name: app_name_clone.clone(),
                                            });
                                            component.set_apps(new_list);
                                        }
                                        Err(e) => {
                                            component
                                                .set_error(format!("Failed to create app: {}", e));
                                        }
                                    }
                                    component.set_loading(false);
                                }
                            }
                        });
                    }

                    #[cfg(not(target_arch = "wasm32"))]
                    {
                        self.app_component
                            .set_error("API operations not supported in native mode".to_string());
                        self.app_component.set_loading(false);
                        self.app_component.clear_processing_operation("create_app");
                    }
                } else {
                    self.app_component
                        .set_error("Not authenticated".to_string());
                    self.app_component.set_loading(false);
                    self.app_component.clear_processing_operation("create_app");
                }
            }
            AppAction::Delete(app_name) => {
                console_log!("Deleting app: {}", app_name);
                self.app_component.set_loading(true);

                if let Some(ref _user_info) = self.auth_state.user_info {
                    let mut client = api::ApiClient::new(self.auth_state.base_url.clone());
                    client.set_api_key(self.auth_state.api_key.clone());

                    let component_ptr: *mut AppManagementComponent =
                        &mut self.app_component as *mut _;
                    let app_name_clone = app_name.clone();

                    #[cfg(target_arch = "wasm32")]
                    {
                        wasm_bindgen_futures::spawn_local(async move {
                            let result = client.delete_app(&app_name_clone).await;
                            let del_key = format!("del_app_{}", app_name_clone);
                            unsafe {
                                if let Some(component) = component_ptr.as_mut() {
                                    component.clear_processing_operation(&del_key);
                                    match result {
                                        Ok(_) => {
                                            component.set_success(format!(
                                                "App '{}' deleted successfully",
                                                app_name_clone
                                            ));

                                            component.apps.retain(|a| a.name != app_name_clone);
                                        }
                                        Err(e) => {
                                            component
                                                .set_error(format!("Failed to delete app: {}", e));
                                        }
                                    }
                                    component.set_loading(false);
                                }
                            }
                        });
                    }

                    #[cfg(not(target_arch = "wasm32"))]
                    {
                        self.app_component
                            .set_error("API operations not supported in native mode".to_string());
                        self.app_component.set_loading(false);
                        self.app_component
                            .clear_processing_operation(&format!("del_app_{}", app_name));
                    }
                } else {
                    self.app_component
                        .set_error("Not authenticated".to_string());
                    self.app_component.set_loading(false);
                    self.app_component
                        .clear_processing_operation(&format!("del_app_{}", app_name));
                }
            }
            AppAction::ViewDeployments(app_name) => {
                console_log!("Viewing deployments for app: {}", app_name);

                self.app_component
                    .clear_processing_operation(&format!("view_deploys_{}", app_name));

                self.current_tab = AppTab::Deployments;
                self.deployment_component
                    .set_app_filter(Some(app_name.clone()));
            }
        }
    }

    fn handle_upload_action(&mut self, action: UploadAction) {
        match action {
            UploadAction::SelectFile => {
                console_log!("File selection requested");
                let op_key = "select_file".to_string();
                #[cfg(target_arch = "wasm32")]
                {
                    use web_sys::wasm_bindgen::JsCast;
                    let window = web_sys::window().expect("no global window");
                    let document = window.document().expect("no document");
                    let input = document
                        .create_element("input")
                        .expect("Failed to create input element")
                        .dyn_into::<web_sys::HtmlInputElement>()
                        .expect("Failed to cast to HtmlInputElement");

                    input.set_type("file");
                    input.set_accept(".tar.xz");

                    let upload_component_ptr: *mut FileUploadComponent =
                        &mut self.upload_component as *mut _;
                    let closure = wasm_bindgen::closure::Closure::wrap(Box::new(
                        move |event: web_sys::Event| {
                            let target = event.target().expect("Event should have target");
                            let input = target
                                .dyn_into::<web_sys::HtmlInputElement>()
                                .expect("Target should be input");

                            if let Some(files) = input.files() {
                                if files.length() > 0 {
                                    if let Some(file) = files.get(0) {
                                        let filename = file.name();
                                        let reader = web_sys::FileReader::new()
                                            .expect("Failed to create FileReader");

                                        let reader_clone = reader.clone();
                                        let upload_ptr = upload_component_ptr;
                                        let filename_clone = filename.clone();

                                        let onload = wasm_bindgen::closure::Closure::wrap(
                                            Box::new(move |_event: web_sys::Event| {
                                                if let Ok(result) = reader_clone.result() {
                                                    if let Ok(array_buffer) =
                                                        result.dyn_into::<js_sys::ArrayBuffer>()
                                                    {
                                                        let uint8_array =
                                                            js_sys::Uint8Array::new(&array_buffer);
                                                        let data = uint8_array.to_vec();

                                                        unsafe {
                                                            if let Some(component) =
                                                                upload_ptr.as_mut()
                                                            {
                                                                component.set_file(
                                                                    filename_clone.clone(),
                                                                    data,
                                                                );
                                                            }
                                                        }
                                                    }
                                                }
                                            })
                                                as Box<dyn FnMut(_)>,
                                        );

                                        reader.set_onload(Some(onload.as_ref().unchecked_ref()));
                                        onload.forget();

                                        reader
                                            .read_as_array_buffer(&file)
                                            .expect("Failed to read file");
                                    }
                                }
                            }
                        },
                    )
                        as Box<dyn FnMut(_)>);

                    input.set_onchange(Some(closure.as_ref().unchecked_ref()));
                    closure.forget();

                    input.click();

                    unsafe {
                        let comp_ptr: *mut FileUploadComponent =
                            &mut self.upload_component as *mut _;
                        if let Some(component) = comp_ptr.as_mut() {
                            component.clear_processing_operation(&op_key);
                        }
                    }
                }
                #[cfg(not(target_arch = "wasm32"))]
                {
                    self.upload_component
                        .set_file("example-app-v1.0.0.tar.xz".to_string(), vec![0u8; 1024]);
                    self.upload_component.clear_processing_operation(&op_key);
                }
            }
            UploadAction::Upload {
                app_name,
                channel_name,
            } => {
                console_log!("Uploading to {}/{}", app_name, channel_name);
                self.upload_component.set_uploading(true);
                self.upload_component.clear_messages();
                let op_key = "upload_bundle".to_string();

                if let Some(ref _user_info) = self.auth_state.user_info {
                    let mut client = api::ApiClient::new(self.auth_state.base_url.clone());
                    client.set_api_key(self.auth_state.api_key.clone());

                    if let (Some(file_data), Some(filename)) = (
                        self.upload_component.get_file_data(),
                        self.upload_component.get_filename(),
                    ) {
                        let file_data_clone = file_data.clone();
                        let filename_clone = filename.clone();
                        let component_ptr: *mut FileUploadComponent =
                            &mut self.upload_component as *mut _;

                        #[cfg(target_arch = "wasm32")]
                        {
                            wasm_bindgen_futures::spawn_local(async move {
                                let result = client
                                    .upload_bundle(
                                        &app_name,
                                        &channel_name,
                                        file_data_clone,
                                        &filename_clone,
                                    )
                                    .await;
                                unsafe {
                                    if let Some(component) = component_ptr.as_mut() {
                                        match result {
                                            Ok(message) => {
                                                component.set_success(message);
                                            }
                                            Err(e) => {
                                                component
                                                    .set_error(format!("Upload failed: {}", e));
                                            }
                                        }
                                        component.set_uploading(false);
                                        component.clear_processing_operation(&op_key);
                                    }
                                }
                            });
                        }

                        #[cfg(not(target_arch = "wasm32"))]
                        {
                            self.upload_component.set_error(
                                "API operations not supported in native mode".to_string(),
                            );
                            self.upload_component.set_uploading(false);
                            self.upload_component.clear_processing_operation(&op_key);
                        }
                    } else {
                        self.upload_component
                            .set_error("No file selected for upload.".to_string());
                        self.upload_component.set_uploading(false);
                        self.upload_component.clear_processing_operation(&op_key);
                    }
                } else {
                    self.upload_component
                        .set_error("Not authenticated".to_string());
                    self.upload_component.set_uploading(false);
                    self.upload_component.clear_processing_operation(&op_key);
                }
            }
        }
    }

    fn handle_channel_action(&mut self, action: ChannelAction) {
        match action {
            ChannelAction::LoadChannels(app_name) => {
                console_log!("Loading channels for app: {}", app_name);
                self.channel_component.set_loading(true);
                let op_key = format!("load_channels_{}", app_name);

                if let Some(ref _user_info) = self.auth_state.user_info {
                    let mut client = api::ApiClient::new(self.auth_state.base_url.clone());
                    client.set_api_key(self.auth_state.api_key.clone());

                    let component_ptr: *mut ChannelManagementComponent =
                        &mut self.channel_component as *mut _;

                    #[cfg(target_arch = "wasm32")]
                    {
                        wasm_bindgen_futures::spawn_local(async move {
                            let result = client.list_channels(&app_name).await;
                            unsafe {
                                if let Some(component) = component_ptr.as_mut() {
                                    match result {
                                        Ok(channels) => {
                                            component.set_channels(channels);
                                        }
                                        Err(e) => {
                                            component.set_error(format!(
                                                "Failed to load channels: {}",
                                                e
                                            ));
                                        }
                                    }
                                    component.set_loading(false);
                                    component.clear_processing_operation(&op_key);
                                }
                            }
                        });
                    }

                    #[cfg(not(target_arch = "wasm32"))]
                    {
                        self.channel_component
                            .set_error("API operations not supported in native mode".to_string());
                        self.channel_component.set_loading(false);
                        self.channel_component.clear_processing_operation(&op_key);
                    }
                } else {
                    self.channel_component
                        .set_error("Not authenticated".to_string());
                    self.channel_component.set_loading(false);
                    self.channel_component.clear_processing_operation(&op_key);
                }
            }
            ChannelAction::Create {
                app_name,
                name,
                public,
            } => {
                console_log!(
                    "Creating channel {} for app {} (public: {})",
                    name,
                    app_name,
                    public
                );
                self.channel_component.set_loading(true);
                let op_key = format!("create_channel_{}:{}", app_name, name);

                if let Some(ref _user_info) = self.auth_state.user_info {
                    let mut client = api::ApiClient::new(self.auth_state.base_url.clone());
                    client.set_api_key(self.auth_state.api_key.clone());

                    let component_ptr: *mut ChannelManagementComponent =
                        &mut self.channel_component as *mut _;
                    let app_name_clone = app_name.clone();

                    #[cfg(target_arch = "wasm32")]
                    {
                        wasm_bindgen_futures::spawn_local(async move {
                            let result = client.create_channel(&app_name, &name, public).await;
                            unsafe {
                                if let Some(component) = component_ptr.as_mut() {
                                    match result {
                                        Ok(_) => {
                                            component.set_success(format!(
                                                "Channel '{}' created successfully!",
                                                name
                                            ));
                                            component.clear_new_channel();

                                            let mut list = component.channels.clone();
                                            list.push(crate::api::Channel {
                                                id: "(pending)".to_string(),
                                                name: name.clone(),
                                                app_id: "".to_string(),
                                                public,
                                                default: false,
                                            });
                                            component.set_channels(list);
                                        }
                                        Err(e) => {
                                            component.set_error(format!(
                                                "Failed to create channel: {}",
                                                e
                                            ));
                                        }
                                    }
                                    component.set_loading(false);
                                    component.clear_processing_operation(&op_key);
                                }
                            }
                        });
                    }

                    #[cfg(not(target_arch = "wasm32"))]
                    {
                        self.channel_component
                            .set_error("API operations not supported in native mode".to_string());
                        self.channel_component.set_loading(false);
                        self.channel_component.clear_processing_operation(&op_key);
                    }
                } else {
                    self.channel_component
                        .set_error("Not authenticated".to_string());
                    self.channel_component.set_loading(false);
                    self.channel_component.clear_processing_operation(&op_key);
                }
            }
            ChannelAction::Delete {
                app_name,
                channel_name,
            } => {
                console_log!("Deleting channel {} from app {}", channel_name, app_name);
                self.channel_component.set_loading(true);
                let op_key = format!("del_channel_{}:{}", app_name, channel_name);

                if let Some(ref _user_info) = self.auth_state.user_info {
                    let mut client = api::ApiClient::new(self.auth_state.base_url.clone());
                    client.set_api_key(self.auth_state.api_key.clone());

                    let component_ptr: *mut ChannelManagementComponent =
                        &mut self.channel_component as *mut _;
                    let app_name_clone = app_name.clone();
                    let channel_name_clone = channel_name.clone();

                    #[cfg(target_arch = "wasm32")]
                    {
                        wasm_bindgen_futures::spawn_local(async move {
                            let result = client.delete_channel(&app_name, &channel_name).await;
                            unsafe {
                                if let Some(component) = component_ptr.as_mut() {
                                    match result {
                                        Ok(_) => {
                                            component.set_success(format!(
                                                "Channel '{}' deleted successfully!",
                                                channel_name_clone
                                            ));

                                            component
                                                .channels
                                                .retain(|c| c.name != channel_name_clone);
                                        }
                                        Err(e) => {
                                            component.set_error(format!(
                                                "Failed to delete channel: {}",
                                                e
                                            ));
                                        }
                                    }
                                    component.set_loading(false);
                                    component.clear_processing_operation(&op_key);
                                }
                            }
                        });
                    }

                    #[cfg(not(target_arch = "wasm32"))]
                    {
                        self.channel_component
                            .set_error("API operations not supported in native mode".to_string());
                        self.channel_component.set_loading(false);
                        self.channel_component.clear_processing_operation(&op_key);
                    }
                } else {
                    self.channel_component
                        .set_error("Not authenticated".to_string());
                    self.channel_component.set_loading(false);
                    self.channel_component.clear_processing_operation(&op_key);
                }
            }
        }
    }

    fn handle_deployment_action(&mut self, action: DeploymentAction) {
        match action {
            DeploymentAction::Load { app, channel } => {
                let same_filters = self.deployment_component.loading
                    && app.as_deref().unwrap_or("") == self.deployment_component.filter_app
                    && channel.as_deref().unwrap_or("") == self.deployment_component.filter_channel;
                if same_filters {
                    return;
                }
                console_log!(
                    "Loading deployments (app: {:?}, channel: {:?})",
                    app,
                    channel
                );
                self.deployment_component.set_loading(true);
                let op_key = format!(
                    "filter_{}:{}",
                    app.clone().unwrap_or_default(),
                    channel.clone().unwrap_or_default()
                );

                if let Some(ref _user_info) = self.auth_state.user_info {
                    let mut client = api::ApiClient::new(self.auth_state.base_url.clone());
                    client.set_api_key(self.auth_state.api_key.clone());

                    let component_ptr: *mut DeploymentManagementComponent =
                        &mut self.deployment_component as *mut _;

                    #[cfg(target_arch = "wasm32")]
                    {
                        wasm_bindgen_futures::spawn_local(async move {
                            let result = client
                                .list_deployments(app.as_deref(), channel.as_deref())
                                .await;
                            unsafe {
                                if let Some(component) = component_ptr.as_mut() {
                                    match result {
                                        Ok(deployments) => {
                                            component.set_deployments(deployments);
                                        }
                                        Err(e) => {
                                            component.set_error(format!(
                                                "Failed to load deployments: {}",
                                                e
                                            ));
                                        }
                                    }
                                    component.set_loading(false);
                                    component.clear_processing_operation(&op_key);
                                }
                            }
                        });
                    }

                    #[cfg(not(target_arch = "wasm32"))]
                    {
                        self.deployment_component
                            .set_error("API operations not supported in native mode".to_string());
                        self.deployment_component.set_loading(false);
                        self.deployment_component
                            .clear_processing_operation(&op_key);
                    }
                } else {
                    self.deployment_component
                        .set_error("Not authenticated".to_string());
                    self.deployment_component.set_loading(false);
                    self.deployment_component
                        .clear_processing_operation(&op_key);
                }
            }
            DeploymentAction::Delete(deployment_id) => {
                console_log!("Deleting deployment: {}", deployment_id);
                self.deployment_component.set_loading(true);
                let op_key = format!("del_deploy_{}", deployment_id);

                if let Some(ref _user_info) = self.auth_state.user_info {
                    let mut client = api::ApiClient::new(self.auth_state.base_url.clone());
                    client.set_api_key(self.auth_state.api_key.clone());

                    let component_ptr: *mut DeploymentManagementComponent =
                        &mut self.deployment_component as *mut _;
                    let deployment_id_clone = deployment_id.clone();

                    #[cfg(target_arch = "wasm32")]
                    {
                        wasm_bindgen_futures::spawn_local(async move {
                            let result = client.delete_deployment(&deployment_id).await;
                            unsafe {
                                if let Some(component) = component_ptr.as_mut() {
                                    match result {
                                        Ok(_) => {
                                            component.set_success(format!(
                                                "Deployment '{}' marked as unavailable",
                                                deployment_id_clone
                                            ));

                                            let app_filter = if !component.filter_app.is_empty() {
                                                Some(component.filter_app.as_str())
                                            } else {
                                                None
                                            };
                                            let channel_filter =
                                                if !component.filter_channel.is_empty() {
                                                    Some(component.filter_channel.as_str())
                                                } else {
                                                    None
                                                };
                                            let refresh_result = client
                                                .list_deployments(app_filter, channel_filter)
                                                .await;
                                            match refresh_result {
                                                Ok(deployments) => {
                                                    component.set_deployments(deployments);
                                                }
                                                Err(e) => {
                                                    component.set_error(format!(
                                                        "Failed to refresh deployments: {}",
                                                        e
                                                    ));
                                                }
                                            }
                                        }
                                        Err(e) => {
                                            component.set_error(format!(
                                                "Failed to make deployment unavailable: {}",
                                                e
                                            ));
                                        }
                                    }
                                    component.set_loading(false);
                                    component.clear_processing_operation(&op_key);
                                }
                            }
                        });
                    }

                    #[cfg(not(target_arch = "wasm32"))]
                    {
                        self.deployment_component
                            .set_error("API operations not supported in native mode".to_string());
                        self.deployment_component.set_loading(false);
                        self.deployment_component
                            .clear_processing_operation(&op_key);
                    }
                } else {
                    self.deployment_component
                        .set_error("Not authenticated".to_string());
                    self.deployment_component.set_loading(false);
                    self.deployment_component
                        .clear_processing_operation(&op_key);
                }
            }
        }
    }
}
