use clap::Parser;
use mcp_prompts_rs::storage::postgres::PostgresStorage;
use mcp_prompts_rs::storage::{filesystem::FileSystemStorage, PromptStorage};
use std::sync::Arc;
use tracing_subscriber::{fmt, EnvFilter};
use actix_web::{web, App, HttpServer, Responder, HttpResponse, get, post, put, delete};
use mcp_prompts_rs::models::prompt::Prompt;
use uuid::Uuid;

// If available, import the rmcp crate for MCP server functionality
// use rmcp::server::{McpServer, McpServerConfig};

#[derive(Parser, Debug)]
#[command(author, version, about, long_about = None)]
struct Cli {
    /// Port to run the server on
    #[arg(long, default_value_t = 8080)]
    port: u16,

    /// Storage backend type (filesystem, postgres)
    #[arg(long, default_value = "filesystem")]
    storage: String,

    /// PostgreSQL connection URL
    #[arg(long)]
    db_url: Option<String>,

    /// Directory for prompt storage (when using filesystem storage)
    #[arg(long, default_value = "./prompts")]
    prompt_dir: String,
}

// --- REST Handlers Implementation ---

#[get("")]
async fn list_prompts_handler(storage: web::Data<Arc<dyn PromptStorage>>) -> impl Responder {
    tracing::info!("Handling GET /prompts");
    match storage.list_prompts().await {
        Ok(prompts) => HttpResponse::Ok().json(prompts),
        Err(e) => {
            tracing::error!(error = %e, "Failed to list prompts");
            HttpResponse::InternalServerError().body("Failed to list prompts")
        }
    }
}

#[get("/{id}")]
async fn get_prompt_handler(
    storage: web::Data<Arc<dyn PromptStorage>>,
    path: web::Path<String>,
) -> impl Responder {
    let id_str = path.into_inner();
    tracing::info!(prompt_id = %id_str, "Handling GET /prompts/{}", id_str);

    match Uuid::parse_str(&id_str) {
        Ok(id_uuid) => match storage.get_prompt(&id_uuid).await {
            Ok(Some(prompt)) => HttpResponse::Ok().json(prompt),
            Ok(None) => {
                tracing::warn!(prompt_id = %id_str, "Prompt not found");
                HttpResponse::NotFound().body(format!("Prompt with id {} not found", id_str))
            }
            Err(e) => {
                tracing::error!(prompt_id = %id_str, error = %e, "Failed to get prompt");
                HttpResponse::InternalServerError().body("Failed to retrieve prompt")
            }
        },
        Err(_) => {
            tracing::warn!(prompt_id = %id_str, "Invalid UUID format provided");
            HttpResponse::BadRequest().body("Invalid prompt ID format. Please use UUID.")
        }
    }
}

#[post("")]
async fn create_prompt_handler(
    storage: web::Data<Arc<dyn PromptStorage>>,
    prompt_data: web::Json<Prompt> // Expect JSON body deserialized into Prompt
) -> impl Responder {
    let prompt = prompt_data.into_inner();
    let prompt_id = prompt.id; // ID is generated in the struct
    tracing::info!(prompt_id = %prompt_id, "Handling POST /prompts");

    // Optional: Add validation for the prompt data here

    match storage.save_prompt(&prompt).await {
        Ok(_) => {
            tracing::info!(prompt_id = %prompt_id, "Prompt created successfully");
            // Return the created prompt (including the generated ID)
            HttpResponse::Created().json(prompt)
        }
        Err(e) => {
            tracing::error!(prompt_id = %prompt_id, error = %e, "Failed to create prompt");
            HttpResponse::InternalServerError().body("Failed to create prompt")
        }
    }
}

#[put("/{id}")]
async fn update_prompt_handler(
    storage: web::Data<Arc<dyn PromptStorage>>,
    path: web::Path<String>,
    prompt_data: web::Json<Prompt> // Expect JSON body with updated prompt
) -> impl Responder {
    let id_str = path.into_inner();
    let mut prompt_update = prompt_data.into_inner();
    tracing::info!(prompt_id = %id_str, "Handling PUT /prompts/{}", id_str);

    match Uuid::parse_str(&id_str) {
        Ok(id_uuid) => {
            // Ensure the ID in the path matches the ID in the body, or set it
            prompt_update.id = id_uuid;

            // Optional: Add validation for the prompt data here

            match storage.save_prompt(&prompt_update).await { // Assuming save_prompt handles create/update
                Ok(_) => {
                    tracing::info!(prompt_id = %id_uuid, "Prompt updated successfully");
                    HttpResponse::Ok().json(prompt_update)
                }
                Err(e) => {
                    tracing::error!(prompt_id = %id_uuid, error = %e, "Failed to update prompt");
                    // Consider specific errors, e.g., NotFound vs InternalServerError
                    HttpResponse::InternalServerError().body("Failed to update prompt")
                }
            }
        }
        Err(_) => {
            tracing::warn!(prompt_id = %id_str, "Invalid UUID format provided for update");
            HttpResponse::BadRequest().body("Invalid prompt ID format. Please use UUID.")
        }
    }
}

#[delete("/{id}")]
async fn delete_prompt_handler(
    storage: web::Data<Arc<dyn PromptStorage>>,
    path: web::Path<String>
) -> impl Responder {
    let id_str = path.into_inner();
    tracing::info!(prompt_id = %id_str, "Handling DELETE /prompts/{}", id_str);

    match Uuid::parse_str(&id_str) {
        Ok(id_uuid) => match storage.delete_prompt(&id_uuid).await {
            Ok(true) => { // Assuming delete_prompt returns true if deleted, false if not found
                tracing::info!(prompt_id = %id_uuid, "Prompt deleted successfully");
                HttpResponse::NoContent().finish() // 204 No Content is standard for successful DELETE
            }
            Ok(false) => {
                tracing::warn!(prompt_id = %id_uuid, "Attempted to delete non-existent prompt");
                HttpResponse::NotFound().body(format!("Prompt with id {} not found", id_str))
            }
            Err(e) => {
                tracing::error!(prompt_id = %id_uuid, error = %e, "Failed to delete prompt");
                HttpResponse::InternalServerError().body("Failed to delete prompt")
            }
        },
        Err(_) => {
            tracing::warn!(prompt_id = %id_str, "Invalid UUID format provided for delete");
            HttpResponse::BadRequest().body("Invalid prompt ID format. Please use UUID.")
        }
    }
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    // Initialize tracing subscriber
    // Use `RUST_LOG=info` (or debug, trace, etc.) to control log level
    // Example: RUST_LOG=mcp_prompts_rs=debug,rmcp=info cargo run
    fmt().with_env_filter(EnvFilter::from_default_env()).init();

    let args = Cli::parse();
    tracing::info!(args = ?args, "Starting MCP Prompts Server");

    // Initialize storage based on args
    let storage: Arc<dyn PromptStorage> = match args.storage.as_str() {
        "filesystem" => {
            tracing::info!(path = %args.prompt_dir, "Using filesystem storage");
            Arc::new(FileSystemStorage::new(args.prompt_dir))
        }
        "postgres" => {
            let db_url = args
                .db_url
                .clone()
                .expect("--db-url is required for postgres storage");
            tracing::info!(url = %db_url, "Using PostgreSQL storage");
            let pg_storage = PostgresStorage::new(&db_url)
                .await
                .expect("Failed to connect to PostgreSQL");
            // Initialize schema (consider making this optional via CLI arg)
            pg_storage
                .init_schema()
                .await
                .expect("Failed to initialize DB schema");
            tracing::info!("Database schema initialized (if not exists)");
            Arc::new(pg_storage)
        }
        _ => {
            tracing::error!(storage_type = %args.storage, "Unsupported storage type specified");
            panic!("Unsupported storage type: {}", args.storage);
        }
    };
    let app_storage: web::Data<Arc<dyn PromptStorage>> = web::Data::new(Arc::clone(&storage)); // Keep storage for REST API

    // --- Temporarily remove MCP Server Handler Initialization ---
    // let mcp_handler = McpPromptServerHandler::new(Arc::clone(&storage));
    // let mcp_server = Arc::new(Server::new(mcp_handler));

    // --- Configure and Start Actix Web Server ---
    let bind_addr = format!("127.0.0.1:{}", args.port);
    tracing::info!(address = %bind_addr, "Starting HTTP server (REST API only for now)");

    HttpServer::new(move || {
        // let mcp_server_clone = Arc::clone(&mcp_server); // Removed
        let app_storage_clone = app_storage.clone();

        // --- Temporarily remove SSE Service Integration ---
        // let sse_service = SseServerTransport::create_service(mcp_server_clone);

        App::new()
            .app_data(app_storage_clone)
            // .wrap(actix_web::middleware::Logger::default())
            .service(
                web::scope("/prompts")
                    .service(list_prompts_handler)
                    .service(get_prompt_handler)
                    .service(create_prompt_handler)
                    .service(update_prompt_handler)
                    .service(delete_prompt_handler),
            )
            // --- Temporarily remove SSE route ---
            // .service(web::scope("/events").service(sse_service))
            .route("/health", web::get().to(|| async { HttpResponse::Ok().body("OK") }))
    })
    .bind(&bind_addr)?
    .run()
    .await
}
