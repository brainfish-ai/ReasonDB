//! Authentication and API key management
//!
//! ReasonDB uses API keys for authentication. Keys follow the format:
//! - `rdb_live_<32_chars>` - Production keys
//! - `rdb_test_<32_chars>` - Test/development keys
//!
//! Only the hash of the key is stored, never the raw key.

mod key;
mod permissions;
mod store;

pub use key::{ApiKey, ApiKeyId, ApiKeyMetadata, KeyPrefix};
pub use permissions::{Permission, Permissions};
pub use store::ApiKeyStore;

use crate::error::ReasonDBError;
use sha2::{Digest, Sha256};

/// Hash an API key for storage (we never store raw keys)
pub fn hash_api_key(key: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(key.as_bytes());
    let result = hasher.finalize();
    hex::encode(result)
}

/// Validate API key format
pub fn validate_key_format(key: &str) -> Result<KeyPrefix, ReasonDBError> {
    if key.len() != 44 {
        // rdb_live_ (9) + 32 chars + 3 for checksum
        return Err(ReasonDBError::Auth("Invalid API key format".into()));
    }

    if key.starts_with("rdb_live_") {
        Ok(KeyPrefix::Live)
    } else if key.starts_with("rdb_test_") {
        Ok(KeyPrefix::Test)
    } else {
        Err(ReasonDBError::Auth("Invalid API key prefix".into()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hash_api_key() {
        let key = "rdb_live_abcdefghijklmnopqrstuvwxyz123456";
        let hash = hash_api_key(key);
        assert_eq!(hash.len(), 64); // SHA256 hex = 64 chars

        // Same key should produce same hash
        let hash2 = hash_api_key(key);
        assert_eq!(hash, hash2);
    }

    #[test]
    fn test_validate_key_format() {
        // Valid live key
        let result = validate_key_format("rdb_live_abcdefghijklmnopqrstuvwxyz12345");
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), KeyPrefix::Live);

        // Valid test key
        let result = validate_key_format("rdb_test_abcdefghijklmnopqrstuvwxyz12345");
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), KeyPrefix::Test);

        // Invalid prefix
        let result = validate_key_format("rdb_fake_abcdefghijklmnopqrstuvwxyz12345");
        assert!(result.is_err());

        // Wrong length
        let result = validate_key_format("rdb_live_short");
        assert!(result.is_err());
    }
}
