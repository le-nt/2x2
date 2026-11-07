use crate::api::{ApiKey, App, CreateApiKeyResponse};
use egui::{Color32, RichText};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiKeyManagementComponent {
    pub api_keys: Vec<ApiKey>,
    pub new_role: String,
    pub loading: bool,
    pub error_message: Option<String>,
    pub success_message: Option<String>,
    pub created_key: Option<CreateApiKeyResponse>,
    #[serde(skip)]
    pub processing_operations: std::collections::HashSet<String>,
}

impl Default for ApiKeyManagementComponent {
    fn default() -> Self {
        Self {
            api_keys: Vec::new(),
            new_role: "readonly".to_string(),
            loading: false,
            error_message: None,
            success_message: None,
            created_key: None,
            processing_operations: std::collections::HashSet::new(),
        }
    }
}

impl ApiKeyManagementComponent {
    pub fn ui(&mut self, ui: &mut egui::Ui) -> Option<ApiKeyAction> {
        let mut action = None;

        ui.heading("API Key Management");
        ui.separator();

        if let Some(ref error) = self.error_message {
            ui.colored_label(Color32::RED, format!("❌ {}", error));
            ui.separator();
        }

        if let Some(ref success) = self.success_message {
            ui.colored_label(Color32::GREEN, format!("✅ {}", success));
            ui.separator();
        }

        if let Some(ref created) = self.created_key {
            let mut key_copy = created.key.clone();
            ui.group(|ui| {
                ui.vertical(|ui| {
                    ui.colored_label(Color32::GREEN, "🔑 New API Key Created!");
                    ui.label("Make sure to copy this key - it won't be shown again:");
                    ui.horizontal(|ui| {
                        ui.text_edit_singleline(&mut key_copy);
                        if ui.button("📋 Copy").clicked() {
                            ui.output_mut(|o| o.copied_text = created.key.clone());
                        }
                    });
                    ui.label(format!("Role: {}", created.role));
                    ui.label(format!("ID: {}", created.id));
                });
            });

            if ui.button("Close").clicked() {
                self.created_key = None;
                self.success_message = None;
            }
            ui.separator();
        }

        ui.group(|ui| {
            ui.vertical(|ui| {
                ui.heading("Create New API Key");

                ui.horizontal(|ui| {
                    ui.label("Role:");
                    egui::ComboBox::from_label("")
                        .selected_text(&self.new_role)
                        .show_ui(ui, |ui| {
                            ui.selectable_value(&mut self.new_role, "admin".to_string(), "admin");
                            ui.selectable_value(
                                &mut self.new_role,
                                "readwrite".to_string(),
                                "readwrite",
                            );
                            ui.selectable_value(
                                &mut self.new_role,
                                "readonly".to_string(),
                                "readonly",
                            );
                        });
                });

                ui.horizontal(|ui| {
                    if ui.button("🔑 Generate API Key").clicked() && !self.loading {
                        action = Some(ApiKeyAction::Create(self.new_role.clone()));
                    }

                    if ui.button("🔄 Refresh List").clicked() && !self.loading {
                        action = Some(ApiKeyAction::Refresh);
                    }
                });
            });
        });

        ui.separator();

        ui.heading("Existing API Keys");

        if self.loading {
            ui.spinner();
            ui.label("Loading...");
        } else if self.api_keys.is_empty() {
            ui.label("No API keys found.");
        } else {
            egui::ScrollArea::vertical().show(ui, |ui| {
                for api_key in &self.api_keys {
                    ui.group(|ui| {
                        ui.horizontal(|ui| {
                            ui.vertical(|ui| {
                                ui.label(RichText::new(format!("ID: {}", &api_key.id)).strong());
                                ui.label(format!("Role: {}", api_key.role));
                                ui.label(format!("Created: {}", api_key.created_at));

                                let status_color = if api_key.active {
                                    Color32::GREEN
                                } else {
                                    Color32::RED
                                };
                                let status_text =
                                    if api_key.active { "Active" } else { "Inactive" };
                                ui.colored_label(status_color, format!("Status: {}", status_text));
                            });

                            ui.with_layout(
                                egui::Layout::right_to_left(egui::Align::Center),
                                |ui| {
                                    ui.add_enabled_ui(!self.loading, |ui| {
                                        let delete_key = format!("delete_{}", api_key.id);
                                        let toggle_key = format!("toggle_{}", api_key.id);

                                        if ui.button("🗑 Delete").clicked()
                                            && !self.processing_operations.contains(&delete_key)
                                        {
                                            self.processing_operations.insert(delete_key);
                                            action = Some(ApiKeyAction::Delete(api_key.id.clone()));
                                        }

                                        let toggle_text = if api_key.active {
                                            "🚫 Deactivate"
                                        } else {
                                            "✅ Activate"
                                        };
                                        if ui.button(toggle_text).clicked()
                                            && !self.processing_operations.contains(&toggle_key)
                                        {
                                            self.processing_operations.insert(toggle_key);
                                            action = Some(ApiKeyAction::Toggle(api_key.id.clone()));
                                        }
                                    });
                                },
                            );
                        });
                    });
                    ui.add_space(5.0);
                }
            });
        }

        action
    }

    pub fn set_loading(&mut self, loading: bool) {
        self.loading = loading;
    }

    pub fn set_error(&mut self, error: String) {
        self.error_message = Some(error);
        self.success_message = None;
    }

    pub fn set_success(&mut self, message: String) {
        self.success_message = Some(message);
        self.error_message = None;
    }

    pub fn set_api_keys(&mut self, api_keys: Vec<ApiKey>) {
        self.api_keys = api_keys;
    }

    pub fn set_created_key(&mut self, created_key: CreateApiKeyResponse) {
        self.created_key = Some(created_key);
    }

    pub fn clear_messages(&mut self) {
        self.error_message = None;
        self.success_message = None;
    }

    pub fn clear_processing_operation(&mut self, operation_id: &str) {
        self.processing_operations.remove(operation_id);
    }

    pub fn clear_all_processing(&mut self) {
        self.processing_operations.clear();
    }
}

#[derive(Debug, Clone)]
pub enum ApiKeyAction {
    Create(String),
    Delete(String),
    Toggle(String),
    Refresh,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppManagementComponent {
    pub apps: Vec<App>,
    pub new_app_name: String,
    pub loading: bool,
    pub error_message: Option<String>,
    pub success_message: Option<String>,
    #[serde(skip)]
    pub processing_operations: std::collections::HashSet<String>,
}

impl Default for AppManagementComponent {
    fn default() -> Self {
        Self {
            apps: Vec::new(),
            new_app_name: String::new(),
            loading: false,
            error_message: None,
            success_message: None,
            processing_operations: std::collections::HashSet::new(),
        }
    }
}

impl AppManagementComponent {
    pub fn ui(&mut self, ui: &mut egui::Ui) -> Option<AppAction> {
        let mut action = None;

        ui.heading("Application Management");
        ui.separator();

        if let Some(ref error) = self.error_message {
            ui.colored_label(Color32::RED, format!("❌ {}", error));
            ui.separator();
        }

        if let Some(ref success) = self.success_message {
            ui.colored_label(Color32::GREEN, format!("✅ {}", success));
            ui.separator();
        }

        ui.group(|ui| {
            ui.vertical(|ui| {
                ui.heading("Create New App");

                ui.horizontal(|ui| {
                    ui.label("Name:");
                    ui.text_edit_singleline(&mut self.new_app_name);
                });

                let op_key = "create_app".to_string();
                if ui.button("➕ Create App").clicked()
                    && !self.new_app_name.is_empty()
                    && !self.loading
                    && !self.processing_operations.contains(&op_key)
                {
                    self.processing_operations.insert(op_key);
                    action = Some(AppAction::Create(self.new_app_name.clone()));
                }
            });
        });

        ui.separator();

        ui.horizontal(|ui| {
            let op_key = "refresh_apps".to_string();
            if ui.button("🔄 Refresh Apps").clicked()
                && !self.loading
                && !self.processing_operations.contains(&op_key)
            {
                self.processing_operations.insert(op_key);
                action = Some(AppAction::Refresh);
            }
        });

        ui.separator();

        if self.loading {
            ui.spinner();
            ui.label("Loading apps...");
        } else if self.apps.is_empty() {
            ui.label("No applications found.");
        } else {
            egui::ScrollArea::vertical().show(ui, |ui| {
                for app in &self.apps {
                    ui.group(|ui| {
                        ui.horizontal(|ui| {
                            ui.vertical(|ui| {
                                ui.label(RichText::new(&app.name).strong());
                                ui.label(format!("ID: {}", app.id));
                            });

                            ui.with_layout(
                                egui::Layout::right_to_left(egui::Align::Center),
                                |ui| {
                                    ui.add_enabled_ui(!self.loading, |ui| {
                                        let del_key = format!("del_app_{}", app.name);
                                        if ui.button("🗑 Delete").clicked()
                                            && !self.processing_operations.contains(&del_key)
                                        {
                                            self.processing_operations.insert(del_key);
                                            action = Some(AppAction::Delete(app.name.clone()));
                                        }
                                        let view_key = format!("view_deploys_{}", app.name);
                                        if ui.button("📦 View Deployments").clicked()
                                            && !self.processing_operations.contains(&view_key)
                                        {
                                            self.processing_operations.insert(view_key);
                                            action =
                                                Some(AppAction::ViewDeployments(app.name.clone()));
                                        }
                                    });
                                },
                            );
                        });
                    });
                    ui.add_space(5.0);
                }
            });
        }

        action
    }

    pub fn set_loading(&mut self, loading: bool) {
        self.loading = loading;
    }

    pub fn set_error(&mut self, error: String) {
        self.error_message = Some(error);
    }

    pub fn set_apps(&mut self, apps: Vec<App>) {
        self.apps = apps;
    }

    pub fn clear_error(&mut self) {
        self.error_message = None;
    }

    pub fn handle_action(&mut self, _action: AppAction) {}

    pub fn set_success(&mut self, message: String) {
        self.success_message = Some(message);
    }

    pub fn clear_new_app_name(&mut self) {
        self.new_app_name.clear();
    }

    pub fn clear_processing_operation(&mut self, op: &str) {
        self.processing_operations.remove(op);
    }

    pub fn clear_all_processing(&mut self) {
        self.processing_operations.clear();
    }
}

#[derive(Debug, Clone)]
pub enum AppAction {
    Refresh,
    Create(String),
    Delete(String),
    ViewDeployments(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileUploadComponent {
    pub selected_file: Option<(String, Vec<u8>)>,
    pub app_name: String,
    pub channel_name: String,
    pub uploading: bool,
    pub error_message: Option<String>,
    pub success_message: Option<String>,
    #[serde(skip)]
    pub processing_operations: std::collections::HashSet<String>,
}

impl Default for FileUploadComponent {
    fn default() -> Self {
        Self {
            selected_file: None,
            app_name: String::new(),
            channel_name: String::new(),
            uploading: false,
            error_message: None,
            success_message: None,
            processing_operations: std::collections::HashSet::new(),
        }
    }
}

impl FileUploadComponent {
    pub fn ui(&mut self, ui: &mut egui::Ui) -> Option<UploadAction> {
        let mut action = None;

        ui.heading("Bundle Upload");
        ui.separator();

        if let Some(ref error) = self.error_message {
            ui.colored_label(Color32::RED, format!("❌ {}", error));
            ui.separator();
        }

        if let Some(ref success) = self.success_message {
            ui.colored_label(Color32::GREEN, format!("✅ {}", success));
            ui.separator();
        }

        ui.group(|ui| {
            ui.vertical(|ui| {
                ui.label("Upload .tar.xz bundle:");

                ui.horizontal(|ui| {
                    ui.label("App Name:");
                    ui.text_edit_singleline(&mut self.app_name);
                });

                ui.horizontal(|ui| {
                    ui.label("Channel:");
                    ui.text_edit_singleline(&mut self.channel_name);
                });

                ui.horizontal(|ui| {
                    let select_key = "select_file".to_string();
                    if ui.button("📁 Select File").clicked()
                        && !self.processing_operations.contains(&select_key)
                    {
                        self.processing_operations.insert(select_key);
                        action = Some(UploadAction::SelectFile);
                    }

                    if let Some((filename, _)) = &self.selected_file {
                        ui.label(format!("Selected: {}", filename));
                    } else {
                        ui.label("No file selected");
                    }
                });

                if self.selected_file.is_some()
                    && !self.app_name.is_empty()
                    && !self.channel_name.is_empty()
                    && !self.uploading
                {
                    let upload_key = "upload_bundle".to_string();
                    if ui.button("🚀 Upload Bundle").clicked()
                        && !self.processing_operations.contains(&upload_key)
                    {
                        self.processing_operations.insert(upload_key);
                        action = Some(UploadAction::Upload {
                            app_name: self.app_name.clone(),
                            channel_name: self.channel_name.clone(),
                        });
                    }
                }

                if self.uploading {
                    ui.spinner();
                    ui.label("Uploading...");
                }
            });
        });

        action
    }

    pub fn set_file(&mut self, filename: String, data: Vec<u8>) {
        self.selected_file = Some((filename, data));
    }

    pub fn get_file_data(&self) -> Option<&Vec<u8>> {
        self.selected_file.as_ref().map(|(_, data)| data)
    }

    pub fn get_filename(&self) -> Option<&String> {
        self.selected_file.as_ref().map(|(filename, _)| filename)
    }

    pub fn set_uploading(&mut self, uploading: bool) {
        self.uploading = uploading;
    }

    pub fn set_error(&mut self, error: String) {
        self.error_message = Some(error);
        self.success_message = None;
    }

    pub fn set_success(&mut self, message: String) {
        self.success_message = Some(message);
        self.error_message = None;
        self.selected_file = None;
    }

    pub fn clear_messages(&mut self) {
        self.error_message = None;
        self.success_message = None;
    }

    pub fn clear_processing_operation(&mut self, op: &str) {
        self.processing_operations.remove(op);
    }

    pub fn clear_all_processing(&mut self) {
        self.processing_operations.clear();
    }
}

#[derive(Debug, Clone)]
pub enum UploadAction {
    SelectFile,
    Upload {
        app_name: String,
        channel_name: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChannelManagementComponent {
    pub channels: Vec<crate::api::Channel>,
    pub selected_app: String,
    pub new_channel_name: String,
    pub new_channel_public: bool,
    pub loading: bool,
    pub error_message: Option<String>,
    pub success_message: Option<String>,
    #[serde(skip)]
    pub processing_operations: std::collections::HashSet<String>,
}

impl Default for ChannelManagementComponent {
    fn default() -> Self {
        Self {
            channels: Vec::new(),
            selected_app: String::new(),
            new_channel_name: String::new(),
            new_channel_public: true,
            loading: false,
            error_message: None,
            success_message: None,
            processing_operations: std::collections::HashSet::new(),
        }
    }
}

impl ChannelManagementComponent {
    pub fn ui(&mut self, ui: &mut egui::Ui, apps: &[crate::api::App]) -> Option<ChannelAction> {
        let mut action = None;

        ui.heading("Channel Management");
        ui.separator();

        if let Some(ref error) = self.error_message {
            ui.colored_label(Color32::RED, format!("❌ {}", error));
            ui.separator();
        }

        if let Some(ref success) = self.success_message {
            ui.colored_label(Color32::GREEN, format!("✅ {}", success));
            ui.separator();
        }

        ui.group(|ui| {
            ui.vertical(|ui| {
                ui.heading("Select App");

                ui.horizontal(|ui| {
                    ui.label("App:");
                    egui::ComboBox::from_label("")
                        .selected_text(if self.selected_app.is_empty() {
                            "Select an app..."
                        } else {
                            &self.selected_app
                        })
                        .show_ui(ui, |ui| {
                            for app in apps {
                                ui.selectable_value(
                                    &mut self.selected_app,
                                    app.name.clone(),
                                    &app.name,
                                );
                            }
                        });
                });

                if !self.selected_app.is_empty() {
                    let load_key = format!("load_channels_{}", self.selected_app);
                    if ui.button("🔄 Load Channels").clicked()
                        && !self.loading
                        && !self.processing_operations.contains(&load_key)
                    {
                        self.processing_operations.insert(load_key);
                        action = Some(ChannelAction::LoadChannels(self.selected_app.clone()));
                    }
                }
            });
        });

        ui.separator();

        if !self.selected_app.is_empty() {
            ui.group(|ui| {
                ui.vertical(|ui| {
                    ui.heading("Create New Channel");

                    ui.horizontal(|ui| {
                        ui.label("Name:");
                        ui.text_edit_singleline(&mut self.new_channel_name);
                    });

                    ui.checkbox(&mut self.new_channel_public, "Public channel");

                    let create_key = format!(
                        "create_channel_{}:{}",
                        self.selected_app, self.new_channel_name
                    );
                    if ui.button("➕ Create Channel").clicked()
                        && !self.new_channel_name.is_empty()
                        && !self.loading
                        && !self.processing_operations.contains(&create_key)
                    {
                        self.processing_operations.insert(create_key.clone());
                        action = Some(ChannelAction::Create {
                            app_name: self.selected_app.clone(),
                            name: self.new_channel_name.clone(),
                            public: self.new_channel_public,
                        });
                    }
                });
            });
        }

        ui.separator();

        if !self.selected_app.is_empty() {
            ui.heading(format!("Channels for '{}'", self.selected_app));

            if self.loading {
                ui.spinner();
                ui.label("Loading...");
            } else if self.channels.is_empty() {
                ui.label("No channels found or not loaded yet.");
            } else {
                egui::ScrollArea::vertical().show(ui, |ui| {
                    for channel in &self.channels {
                        ui.group(|ui| {
                            ui.horizontal(|ui| {
                                ui.vertical(|ui| {
                                    ui.label(RichText::new(&channel.name).strong());
                                    ui.label(format!("ID: {}", channel.id));
                                    let visibility =
                                        if channel.public { "Public" } else { "Internal" };
                                    let color = if channel.public {
                                        Color32::GREEN
                                    } else {
                                        Color32::YELLOW
                                    };
                                    ui.colored_label(color, format!("{}", visibility));
                                    if channel.default {
                                        ui.colored_label(Color32::GOLD, "⭐ Default");
                                    }
                                });

                                ui.with_layout(
                                    egui::Layout::right_to_left(egui::Align::Center),
                                    |ui| {
                                        ui.add_enabled_ui(!self.loading, |ui| {
                                            let del_key = format!(
                                                "del_channel_{}:{}",
                                                self.selected_app, channel.name
                                            );
                                            if ui.button("🗑 Delete").clicked()
                                                && !self.processing_operations.contains(&del_key)
                                            {
                                                self.processing_operations.insert(del_key);
                                                action = Some(ChannelAction::Delete {
                                                    app_name: self.selected_app.clone(),
                                                    channel_name: channel.name.clone(),
                                                });
                                            }
                                        });
                                    },
                                );
                            });
                        });
                        ui.add_space(5.0);
                    }
                });
            }
        }

        action
    }

    pub fn set_loading(&mut self, loading: bool) {
        self.loading = loading;
    }

    pub fn set_error(&mut self, error: String) {
        self.error_message = Some(error);
        self.success_message = None;
    }

    pub fn set_success(&mut self, message: String) {
        self.success_message = Some(message);
        self.error_message = None;
    }

    pub fn set_channels(&mut self, channels: Vec<crate::api::Channel>) {
        self.channels = channels;
    }

    pub fn clear_messages(&mut self) {
        self.error_message = None;
        self.success_message = None;
    }

    pub fn clear_new_channel(&mut self) {
        self.new_channel_name.clear();
        self.new_channel_public = true;
    }

    pub fn clear_processing_operation(&mut self, op: &str) {
        self.processing_operations.remove(op);
    }

    pub fn clear_all_processing(&mut self) {
        self.processing_operations.clear();
    }
}

#[derive(Debug, Clone)]
pub enum ChannelAction {
    LoadChannels(String),
    Create {
        app_name: String,
        name: String,
        public: bool,
    },
    Delete {
        app_name: String,
        channel_name: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeploymentManagementComponent {
    pub deployments: Vec<crate::api::Deployment>,
    pub filter_app: String,
    pub filter_channel: String,
    pub loading: bool,
    pub error_message: Option<String>,
    pub success_message: Option<String>,
    #[serde(skip)]
    pub processing_operations: std::collections::HashSet<String>,
    #[serde(skip)]
    pub needs_initial_load: bool,
}

impl Default for DeploymentManagementComponent {
    fn default() -> Self {
        Self {
            deployments: Vec::new(),
            filter_app: String::new(),
            filter_channel: String::new(),
            loading: false,
            error_message: None,
            success_message: None,
            processing_operations: std::collections::HashSet::new(),
            needs_initial_load: false,
        }
    }
}

impl DeploymentManagementComponent {
    pub fn ui(&mut self, ui: &mut egui::Ui, apps: &[crate::api::App]) -> Option<DeploymentAction> {
        let mut action = None;

        ui.heading("Deployment Management");
        ui.separator();

        if let Some(ref error) = self.error_message {
            ui.colored_label(Color32::RED, format!("❌ {}", error));
            ui.separator();
        }

        if let Some(ref success) = self.success_message {
            ui.colored_label(Color32::GREEN, format!("✅ {}", success));
            ui.separator();
        }

        ui.group(|ui| {
            ui.vertical(|ui| {
                ui.heading("Filters");

                ui.horizontal(|ui| {
                    ui.label("App:");
                    egui::ComboBox::from_label("")
                        .selected_text(if self.filter_app.is_empty() {
                            "All apps"
                        } else {
                            &self.filter_app
                        })
                        .show_ui(ui, |ui| {
                            ui.selectable_value(&mut self.filter_app, String::new(), "All apps");
                            for app in apps {
                                ui.selectable_value(
                                    &mut self.filter_app,
                                    app.name.clone(),
                                    &app.name,
                                );
                            }
                        });
                });

                ui.horizontal(|ui| {
                    ui.label("Channel:");
                    ui.text_edit_singleline(&mut self.filter_channel);
                    let filter_key = format!("filter_{}:{}", self.filter_app, self.filter_channel);
                    if ui.button("🔍 Filter").clicked()
                        && !self.loading
                        && !self.processing_operations.contains(&filter_key)
                    {
                        self.processing_operations.insert(filter_key);
                        let app_filter = if self.filter_app.is_empty() {
                            None
                        } else {
                            Some(self.filter_app.as_str())
                        };
                        let channel_filter = if self.filter_channel.is_empty() {
                            None
                        } else {
                            Some(self.filter_channel.as_str())
                        };
                        action = Some(DeploymentAction::Load {
                            app: app_filter.map(String::from),
                            channel: channel_filter.map(String::from),
                        });
                    }
                });
            });
        });

        ui.separator();

        ui.heading("Deployments");

        if self.loading {
            ui.spinner();
            ui.label("Loading...");
        } else if self.deployments.is_empty() {
            ui.label("No deployments found. Use filters above to load deployments.");
        } else {
            egui::ScrollArea::vertical().show(ui, |ui| {
                for deployment in &self.deployments {
                    ui.group(|ui| {
                        ui.horizontal(|ui| {
                            ui.vertical(|ui| {
                                ui.label(RichText::new(&deployment.id).strong());
                                ui.label(format!("📄 {}", deployment.filename));
                                ui.label(format!("🔗 SHA1: {}", &deployment.sha1[..8]));
                                ui.label(format!("📅 {}", deployment.created_at));

                                ui.horizontal(|ui| {
                                    if deployment.is_done {
                                        ui.colored_label(Color32::GREEN, "✅ Done");
                                    } else {
                                        ui.colored_label(Color32::YELLOW, "⏳ Processing");
                                    }

                                    if deployment.is_available {
                                        ui.colored_label(Color32::GREEN, "📦 Available");
                                    } else {
                                        ui.colored_label(Color32::RED, "❌ Unavailable");
                                    }
                                });
                            });

                            ui.with_layout(
                                egui::Layout::right_to_left(egui::Align::Center),
                                |ui| {
                                    let del_key = format!("del_deploy_{}", deployment.id);
                                    if ui.button("� Make Unavailable").clicked()
                                        && !self.processing_operations.contains(&del_key)
                                    {
                                        self.processing_operations.insert(del_key);
                                        action =
                                            Some(DeploymentAction::Delete(deployment.id.clone()));
                                    }
                                },
                            );
                        });
                    });
                    ui.add_space(5.0);
                }
            });
        }

        action
    }

    pub fn set_loading(&mut self, loading: bool) {
        self.loading = loading;
    }

    pub fn set_error(&mut self, error: String) {
        self.error_message = Some(error);
        self.success_message = None;
    }

    pub fn set_success(&mut self, message: String) {
        self.success_message = Some(message);
        self.error_message = None;
    }

    pub fn set_deployments(&mut self, deployments: Vec<crate::api::Deployment>) {
        self.deployments = deployments;
    }

    pub fn clear_messages(&mut self) {
        self.error_message = None;
        self.success_message = None;
    }

    pub fn set_app_filter(&mut self, app_filter: Option<String>) {
        self.filter_app = app_filter.unwrap_or_default();
        self.needs_initial_load = true;
    }

    pub fn clear_processing_operation(&mut self, op: &str) {
        self.processing_operations.remove(op);
    }

    pub fn clear_all_processing(&mut self) {
        self.processing_operations.clear();
    }
}

#[derive(Debug, Clone)]
pub enum DeploymentAction {
    Load {
        app: Option<String>,
        channel: Option<String>,
    },
    Delete(String),
}
