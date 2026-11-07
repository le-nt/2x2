use std::collections::HashSet;
use std::fmt;

#[derive(Debug, Clone, PartialEq)]
pub enum Role {
    Guest,
    ReadOnly,
    ReadWrite,
    Admin,
}

impl fmt::Display for Role {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

impl Role {
    pub fn from_str(s: &str) -> Option<Role> {
        match s {
            "guest" => Some(Role::Guest),
            "readonly" => Some(Role::ReadOnly),
            "readwrite" => Some(Role::ReadWrite),
            "admin" => Some(Role::Admin),
            _ => None,
        }
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            Role::Guest => "guest",
            Role::ReadOnly => "readonly",
            Role::ReadWrite => "readwrite",
            Role::Admin => "admin",
        }
    }

    pub fn get_inherited_roles(&self) -> Vec<Role> {
        match self {
            Role::Guest => vec![Role::Guest],
            Role::ReadOnly => vec![Role::ReadOnly, Role::Guest],
            Role::ReadWrite => vec![Role::ReadWrite, Role::ReadOnly, Role::Guest],
            Role::Admin => vec![Role::Admin],
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub enum Privilege {
    AppRead,
    AppWrite,
    ChannelRead,
    ChannelWrite,
    DeploymentRead,
    DeploymentWrite,
}

impl Privilege {
    pub fn from_str(s: &str) -> Option<Privilege> {
        match s {
            "app.read" => Some(Privilege::AppRead),
            "app.write" => Some(Privilege::AppWrite),
            "channel.read" => Some(Privilege::ChannelRead),
            "channel.write" => Some(Privilege::ChannelWrite),
            "deployment.read" => Some(Privilege::DeploymentRead),
            "deployment.write" => Some(Privilege::DeploymentWrite),
            _ => None,
        }
    }
}

fn get_role_privileges(role: &Role) -> HashSet<Privilege> {
    match role {
        Role::Guest => vec![Privilege::AppRead].into_iter().collect(),
        Role::ReadOnly => vec![
            Privilege::AppRead,
            Privilege::ChannelRead,
            Privilege::DeploymentRead,
        ]
        .into_iter()
        .collect(),
        Role::ReadWrite => vec![
            Privilege::AppWrite,
            Privilege::ChannelWrite,
            Privilege::DeploymentWrite,
        ]
        .into_iter()
        .collect(),
        Role::Admin => vec![
            Privilege::AppRead,
            Privilege::AppWrite,
            Privilege::ChannelRead,
            Privilege::ChannelWrite,
            Privilege::DeploymentRead,
            Privilege::DeploymentWrite,
        ]
        .into_iter()
        .collect(),
    }
}

pub fn is_allowed(role: &str, _resource: Option<&str>, privilege: Option<&str>) -> bool {
    let role_enum = match Role::from_str(role) {
        Some(r) => r,
        None => return false,
    };

    if role_enum == Role::Admin {
        return true;
    }

    let privilege_enum = match privilege {
        Some(p) => match Privilege::from_str(p) {
            Some(priv_enum) => priv_enum,
            None => return false,
        },
        None => return true,
    };

    for inherited_role in role_enum.get_inherited_roles() {
        let role_privileges = get_role_privileges(&inherited_role);
        if role_privileges.contains(&privilege_enum) {
            return true;
        }
    }

    false
}

pub fn is_denied(role: &str, resource: Option<&str>, privilege: Option<&str>) -> bool {
    !is_allowed(role, resource, privilege)
}

pub fn can_read_apps(role: &str) -> bool {
    is_allowed(role, None, Some("app.read"))
}

pub fn can_write_apps(role: &str) -> bool {
    is_allowed(role, None, Some("app.write"))
}

pub fn can_read_channel(role: &str, _channel_resource: Option<&str>) -> bool {
    is_allowed(role, None, Some("channel.read"))
}

pub fn can_write_channel(role: &str, _channel_resource: Option<&str>) -> bool {
    is_allowed(role, None, Some("channel.write"))
}

pub fn can_read_deployment(role: &str, _channel_resource: Option<&str>) -> bool {
    is_allowed(role, None, Some("deployment.read"))
}

pub fn can_write_deployment(role: &str, _channel_resource: Option<&str>) -> bool {
    is_allowed(role, None, Some("deployment.write"))
}

pub fn channel_resource(channel_id: &str) -> String {
    format!("channel:{}", channel_id)
}
