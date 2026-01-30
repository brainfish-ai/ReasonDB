//! Permission system for API keys

use serde::{Deserialize, Serialize};
use std::collections::HashSet;

/// Individual permission
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Permission {
    /// Can read documents, search, query
    Read,

    /// Can create/update/delete documents and tables
    Write,

    /// Can manage API keys and configuration
    Admin,

    /// Can access ingestion endpoints
    Ingest,

    /// Can create document relationships
    Relations,

    /// Can execute RQL queries
    Query,
}

impl Permission {
    /// Get all available permissions
    pub fn all() -> Vec<Permission> {
        vec![
            Permission::Read,
            Permission::Write,
            Permission::Admin,
            Permission::Ingest,
            Permission::Relations,
            Permission::Query,
        ]
    }

    /// Get default permissions for a new key
    pub fn default_set() -> Vec<Permission> {
        vec![
            Permission::Read,
            Permission::Write,
            Permission::Ingest,
            Permission::Relations,
            Permission::Query,
        ]
    }
}

impl std::fmt::Display for Permission {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Permission::Read => write!(f, "read"),
            Permission::Write => write!(f, "write"),
            Permission::Admin => write!(f, "admin"),
            Permission::Ingest => write!(f, "ingest"),
            Permission::Relations => write!(f, "relations"),
            Permission::Query => write!(f, "query"),
        }
    }
}

impl std::str::FromStr for Permission {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "read" => Ok(Permission::Read),
            "write" => Ok(Permission::Write),
            "admin" => Ok(Permission::Admin),
            "ingest" => Ok(Permission::Ingest),
            "relations" => Ok(Permission::Relations),
            "query" => Ok(Permission::Query),
            _ => Err(format!("Unknown permission: {}", s)),
        }
    }
}

/// Set of permissions for an API key
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Permissions {
    permissions: HashSet<Permission>,
}

impl Permissions {
    /// Create a new permission set
    pub fn new(perms: Vec<Permission>) -> Self {
        Self {
            permissions: perms.into_iter().collect(),
        }
    }

    /// Create a permission set with all permissions
    pub fn all() -> Self {
        Self::new(Permission::all())
    }

    /// Create a permission set with default permissions (no admin)
    pub fn default_user() -> Self {
        Self::new(Permission::default_set())
    }

    /// Create a read-only permission set
    pub fn read_only() -> Self {
        Self::new(vec![Permission::Read, Permission::Query])
    }

    /// Check if this set contains a permission
    pub fn has(&self, perm: Permission) -> bool {
        self.permissions.contains(&perm)
    }

    /// Check if this set has all of the given permissions
    pub fn has_all(&self, perms: &[Permission]) -> bool {
        perms.iter().all(|p| self.has(*p))
    }

    /// Check if this set has any of the given permissions
    pub fn has_any(&self, perms: &[Permission]) -> bool {
        perms.iter().any(|p| self.has(*p))
    }

    /// Add a permission to this set
    pub fn add(&mut self, perm: Permission) {
        self.permissions.insert(perm);
    }

    /// Remove a permission from this set
    pub fn remove(&mut self, perm: Permission) {
        self.permissions.remove(&perm);
    }

    /// Get all permissions as a vector
    pub fn to_vec(&self) -> Vec<Permission> {
        self.permissions.iter().copied().collect()
    }

    /// Get permissions as a comma-separated string
    pub fn to_string_list(&self) -> String {
        let mut perms: Vec<_> = self.permissions.iter().map(|p| p.to_string()).collect();
        perms.sort();
        perms.join(", ")
    }
}

impl Default for Permissions {
    fn default() -> Self {
        Self::default_user()
    }
}

impl std::fmt::Display for Permissions {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.to_string_list())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_permissions() {
        let perms = Permissions::new(vec![Permission::Read, Permission::Write]);

        assert!(perms.has(Permission::Read));
        assert!(perms.has(Permission::Write));
        assert!(!perms.has(Permission::Admin));
    }

    #[test]
    fn test_has_all() {
        let perms = Permissions::all();
        assert!(perms.has_all(&[Permission::Read, Permission::Write, Permission::Admin]));

        let limited = Permissions::read_only();
        assert!(!limited.has_all(&[Permission::Read, Permission::Write]));
    }

    #[test]
    fn test_permission_from_str() {
        assert_eq!("read".parse::<Permission>().unwrap(), Permission::Read);
        assert_eq!("WRITE".parse::<Permission>().unwrap(), Permission::Write);
        assert!("invalid".parse::<Permission>().is_err());
    }
}
