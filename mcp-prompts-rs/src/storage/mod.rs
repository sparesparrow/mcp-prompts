use crate::models::prompt::Prompt;
use anyhow::Result;
use async_trait::async_trait;
use uuid::Uuid;

pub mod filesystem;
pub mod postgres;

/// Trait defining the interface for prompt storage backends.
#[async_trait]
pub trait PromptStorage: Send + Sync + 'static { // Ensure Send + Sync for Arc<dyn T>
    /// Lists all prompts available in the storage.
    async fn list_prompts(&self) -> Result<Vec<Prompt>>;

    /// Retrieves a specific prompt by its ID.
    async fn get_prompt(&self, id: &Uuid) -> Result<Option<Prompt>>;

    /// Saves a prompt (creates if new, updates if exists based on ID).
    async fn save_prompt(&self, prompt: &Prompt) -> Result<()>;

    /// Deletes a prompt by its ID.
    /// Returns true if the prompt was deleted, false if it was not found.
    async fn delete_prompt(&self, id: &Uuid) -> Result<bool>;

    // Optional: Add methods for initialization or schema management if needed
    // async fn init_storage(&self) -> Result<()>;
}
