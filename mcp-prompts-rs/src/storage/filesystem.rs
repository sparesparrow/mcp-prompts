use crate::models::prompt::Prompt;
use crate::storage::PromptStorage;
use anyhow::{Context, Result};
use async_trait::async_trait;
use std::path::{Path, PathBuf};
use tokio::fs;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tracing::{error, warn};
use uuid::Uuid;

#[derive(Debug, Clone)]
pub struct FileSystemStorage {
    prompt_dir: PathBuf,
}

impl FileSystemStorage {
    /// Creates a new FileSystemStorage instance.
    /// Ensures the prompt directory exists.
    pub fn new<P: AsRef<Path>>(prompt_dir: P) -> Self {
        let path_buf = prompt_dir.as_ref().to_path_buf();
        // Ensure directory exists (synchronous for simplicity in constructor)
        if let Err(e) = std::fs::create_dir_all(&path_buf) {
            // Log error but proceed; async methods will handle failures
            error!(path = %path_buf.display(), error = %e, "Failed to create prompt directory during initialization");
        }
        Self { prompt_dir: path_buf }
    }

    fn get_prompt_path(&self, id: &Uuid) -> PathBuf {
        self.prompt_dir.join(format!("{}.json", id))
    }
}

#[async_trait]
impl PromptStorage for FileSystemStorage {
    async fn list_prompts(&self) -> Result<Vec<Prompt>> {
        let mut prompts = Vec::new();
        let mut read_dir = fs::read_dir(&self.prompt_dir)
            .await
            .with_context(|| format!("Failed to read prompt directory '{}'", self.prompt_dir.display()))?;

        while let Some(entry) = read_dir.next_entry().await? {
            let path = entry.path();
            if path.is_file() && path.extension().map_or(false, |ext| ext == "json") {
                if let Some(stem) = path.file_stem().and_then(|s| s.to_str()) {
                    if let Ok(id) = Uuid::parse_str(stem) {
                        match self.get_prompt(&id).await {
                            Ok(Some(prompt)) => prompts.push(prompt),
                            Ok(None) => warn!(path = %path.display(), "Prompt file found but failed to read/deserialize"),
                            Err(e) => warn!(path = %path.display(), error = %e, "Error reading prompt file during list"),
                        }
                    }
                }
            }
        }
        Ok(prompts)
    }

    async fn get_prompt(&self, id: &Uuid) -> Result<Option<Prompt>> {
        let path = self.get_prompt_path(id);
        if !path.exists() {
            return Ok(None);
        }

        match fs::File::open(&path).await {
            Ok(mut file) => {
                let mut contents = String::new();
                if let Err(e) = file.read_to_string(&mut contents).await {
                    return Err(e).with_context(|| format!("Failed to read prompt file: {}", path.display()));
                }
                serde_json::from_str(&contents)
                    .map(Some)
                    .with_context(|| format!("Failed to deserialize prompt from file: {}", path.display()))
            }
            Err(ref e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
            Err(e) => Err(e).with_context(|| format!("Failed to open prompt file: {}", path.display())),
        }
    }

    async fn save_prompt(&self, prompt: &Prompt) -> Result<()> {
        let path = self.get_prompt_path(&prompt.id);
        let contents = serde_json::to_string_pretty(prompt)
            .with_context(|| format!("Failed to serialize prompt ID {}", prompt.id))?;

        // Ensure directory exists before writing
        if !self.prompt_dir.exists() {
            fs::create_dir_all(&self.prompt_dir)
                .await
                .with_context(|| format!("Failed to create prompt directory '{}'", self.prompt_dir.display()))?;
        }

        let mut file = fs::File::create(&path)
            .await
            .with_context(|| format!("Failed to create/open prompt file for writing: {}", path.display()))?;

        file.write_all(contents.as_bytes())
            .await
            .with_context(|| format!("Failed to write to prompt file: {}", path.display()))
    }

    async fn delete_prompt(&self, id: &Uuid) -> Result<bool> {
        let path = self.get_prompt_path(id);
        if !path.exists() {
            return Ok(false); // Not found
        }

        match fs::remove_file(&path).await {
            Ok(_) => Ok(true),
            Err(ref e) if e.kind() == std::io::ErrorKind::NotFound => Ok(false),
            Err(e) => Err(e).with_context(|| format!("Failed to delete prompt file: {}", path.display())),
        }
    }
}
