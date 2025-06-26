use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Represents an AI prompt with metadata.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Prompt {
    #[serde(default = "Uuid::new_v4")] // Default to a new UUID if missing during deserialization
    pub id: Uuid,
    pub name: String,
    pub content: String,
    pub category: Option<String>, // e.g., "development", "writing"
    pub variables: Option<Vec<String>>, // Placeholder names like {{variable_name}}
    // Add other relevant fields like created_at, updated_at if needed
    // pub created_at: Option<chrono::DateTime<chrono::Utc>>,
    // pub updated_at: Option<chrono::DateTime<chrono::Utc>>,
}

// Optional: Implement methods for the Prompt struct if needed
impl Prompt {
    // Example: A constructor function
    pub fn new(name: String, content: String, category: Option<String>, variables: Option<Vec<String>>) -> Self {
        Self {
            id: Uuid::new_v4(),
            name,
            content,
            category,
            variables,
            // created_at: Some(chrono::Utc::now()),
            // updated_at: Some(chrono::Utc::now()),
        }
    }
}
