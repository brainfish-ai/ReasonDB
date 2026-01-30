//! In-memory rate limit store
//!
//! Stores token buckets per client identifier (API key or IP).

use super::limiter::{RateLimitConfig, RateLimitResult, RateLimiter, TokenBucket};
use std::collections::HashMap;
use std::sync::{Arc, RwLock};
use std::time::{Duration, Instant};

/// Client identifier for rate limiting
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub enum ClientId {
    /// API key identifier
    ApiKey(String),
    /// IP address (for unauthenticated requests)
    IpAddress(String),
    /// Combined key and IP (for additional security)
    KeyAndIp { key: String, ip: String },
}

impl ClientId {
    /// Create from API key
    pub fn from_key(key: impl Into<String>) -> Self {
        ClientId::ApiKey(key.into())
    }

    /// Create from IP address
    pub fn from_ip(ip: impl Into<String>) -> Self {
        ClientId::IpAddress(ip.into())
    }

    /// Create from both key and IP
    pub fn from_key_and_ip(key: impl Into<String>, ip: impl Into<String>) -> Self {
        ClientId::KeyAndIp {
            key: key.into(),
            ip: ip.into(),
        }
    }
}

/// Entry in the rate limit store
struct RateLimitEntry {
    bucket: TokenBucket,
    last_access: Instant,
    config: RateLimitConfig,
}

/// Thread-safe rate limit store
pub struct RateLimitStore {
    /// Buckets per client
    buckets: RwLock<HashMap<ClientId, RateLimitEntry>>,
    /// Default rate limiter
    default_limiter: RateLimiter,
    /// Custom configs per client
    custom_configs: RwLock<HashMap<ClientId, RateLimitConfig>>,
    /// Cleanup interval
    #[allow(dead_code)]
    cleanup_interval: Duration,
    /// Entry expiry time
    entry_expiry: Duration,
}

impl RateLimitStore {
    /// Create a new rate limit store
    pub fn new(config: RateLimitConfig) -> Self {
        Self {
            buckets: RwLock::new(HashMap::new()),
            default_limiter: RateLimiter::new(config),
            custom_configs: RwLock::new(HashMap::new()),
            cleanup_interval: Duration::from_secs(300), // 5 minutes
            entry_expiry: Duration::from_secs(3600),    // 1 hour
        }
    }

    /// Check rate limit for a client
    pub fn check(&self, client: &ClientId) -> RateLimitResult {
        if !self.default_limiter.is_enabled() {
            return RateLimitResult::unlimited();
        }

        let mut buckets = self.buckets.write().unwrap();

        // Get or create entry
        let entry = buckets.entry(client.clone()).or_insert_with(|| {
            let config = self.get_config(client);
            let limiter = RateLimiter::new(config.clone());
            RateLimitEntry {
                bucket: limiter.create_bucket(),
                last_access: Instant::now(),
                config,
            }
        });

        entry.last_access = Instant::now();

        // Check with the entry's specific limiter
        let limiter = RateLimiter::new(entry.config.clone());
        limiter.check(&mut entry.bucket)
    }

    /// Get config for a client (custom or default)
    fn get_config(&self, client: &ClientId) -> RateLimitConfig {
        let custom = self.custom_configs.read().unwrap();
        custom
            .get(client)
            .cloned()
            .unwrap_or_else(|| self.default_limiter.config().clone())
    }

    /// Set custom rate limit config for a client
    pub fn set_custom_config(&self, client: ClientId, config: RateLimitConfig) {
        let mut custom = self.custom_configs.write().unwrap();
        custom.insert(client.clone(), config.clone());

        // Update existing bucket if present
        let mut buckets = self.buckets.write().unwrap();
        if let Some(entry) = buckets.get_mut(&client) {
            entry.config = config.clone();
            let limiter = RateLimiter::new(config);
            entry.bucket = limiter.create_bucket();
        }
    }

    /// Remove custom config for a client
    pub fn remove_custom_config(&self, client: &ClientId) {
        let mut custom = self.custom_configs.write().unwrap();
        custom.remove(client);

        // Reset bucket to default config
        let mut buckets = self.buckets.write().unwrap();
        if let Some(entry) = buckets.get_mut(client) {
            entry.config = self.default_limiter.config().clone();
            entry.bucket = self.default_limiter.create_bucket();
        }
    }

    /// Get current status for a client without consuming tokens
    pub fn status(&self, client: &ClientId) -> RateLimitResult {
        let buckets = self.buckets.read().unwrap();

        if let Some(entry) = buckets.get(client) {
            let config = &entry.config;
            // Clone the bucket to check without modifying
            let mut bucket_clone = entry.bucket.clone();
            let remaining = bucket_clone.current_tokens();

            RateLimitResult::allowed(
                config.requests_per_minute,
                remaining,
                bucket_clone.seconds_until_reset(),
            )
        } else {
            // No entry yet, return default limits
            let config = self.default_limiter.config();
            RateLimitResult::allowed(config.requests_per_minute, config.burst_size, 60)
        }
    }

    /// Clean up expired entries
    pub fn cleanup(&self) {
        let mut buckets = self.buckets.write().unwrap();
        let now = Instant::now();

        buckets.retain(|_, entry| now.duration_since(entry.last_access) < self.entry_expiry);
    }

    /// Get the number of tracked clients
    pub fn client_count(&self) -> usize {
        self.buckets.read().unwrap().len()
    }

    /// Get all client IDs
    pub fn clients(&self) -> Vec<ClientId> {
        self.buckets.read().unwrap().keys().cloned().collect()
    }

    /// Check if rate limiting is enabled
    pub fn is_enabled(&self) -> bool {
        self.default_limiter.is_enabled()
    }

    /// Get default config
    pub fn default_config(&self) -> &RateLimitConfig {
        self.default_limiter.config()
    }
}

impl Default for RateLimitStore {
    fn default() -> Self {
        Self::new(RateLimitConfig::default())
    }
}

/// Thread-safe wrapper for RateLimitStore
pub type SharedRateLimitStore = Arc<RateLimitStore>;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_store_tracks_clients() {
        let store = RateLimitStore::default();
        let client1 = ClientId::from_key("key1");
        let client2 = ClientId::from_ip("192.168.1.1");

        // Access both clients
        store.check(&client1);
        store.check(&client2);

        assert_eq!(store.client_count(), 2);
    }

    #[test]
    fn test_custom_config() {
        let store = RateLimitStore::new(RateLimitConfig {
            requests_per_minute: 10,
            requests_per_hour: 0,
            burst_size: 2,
            enabled: true,
        });

        let client = ClientId::from_key("premium-key");

        // Set premium limits
        store.set_custom_config(
            client.clone(),
            RateLimitConfig {
                requests_per_minute: 100,
                requests_per_hour: 0,
                burst_size: 20,
                enabled: true,
            },
        );

        // Should be able to make more requests
        for _ in 0..15 {
            let result = store.check(&client);
            assert!(result.allowed, "Request should be allowed with premium limits");
        }
    }

    #[test]
    fn test_separate_client_limits() {
        let store = RateLimitStore::new(RateLimitConfig {
            requests_per_minute: 60,
            requests_per_hour: 0,
            burst_size: 3,
            enabled: true,
        });

        let client1 = ClientId::from_key("key1");
        let client2 = ClientId::from_key("key2");

        // Exhaust client1's burst
        for _ in 0..3 {
            store.check(&client1);
        }
        let result1 = store.check(&client1);
        assert!(!result1.allowed);

        // client2 should still have full burst
        for _ in 0..3 {
            let result = store.check(&client2);
            assert!(result.allowed);
        }
    }
}
