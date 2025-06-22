# Android Integration Guide for MCP-Prompts

This guide provides instructions for mobile developers on how to integrate and use the `mcp-prompts` native Rust library within an Android application. The native library provides high-performance, direct access to the MCP-Prompts server API.

## 🎯 Purpose of the Native Library

The native library, written in Rust, serves as a bridge between your Kotlin/Java Android code and the MCP-Prompts server. It handles:

- Efficiently making API requests to the server.
- Parsing JSON responses.
- Providing a simple, asynchronous API to your Android code via JNI.

Using the native library is recommended for performance and for keeping API logic consistent across platforms.

## 🏗️ Project Structure

The key components for Android integration are located in the `android_app` directory:

- `android/app`: The main Android application module.
- `android/mcp_native_service`: The Rust crate containing the native service logic.

## 🛠️ How to Call Rust from Kotlin

Communication between Kotlin and Rust is achieved through the Java Native Interface (JNI). The setup is as follows:

1.  **Rust Functions:** Rust functions intended to be called from Kotlin are marked with `#[no_mangle] pub extern "C"` and use JNI types.
2.  **Kotlin `external` Functions:** In your Kotlin code, you declare `external` functions that correspond to the Rust functions. The `System.loadLibrary("mcp_native_service")` call loads the compiled Rust code.
3.  **`McpService.kt`:** This service class in the Android app wraps the `external` function calls, providing a clean, asynchronous interface using Kotlin coroutines.

### Example: Fetching a Prompt

Here is a simplified example of how a prompt is fetched from the native library.

**Rust (`lib.rs`):**

```rust
#[no_mangle]
pub extern "C" fn Java_com_sparesparrow_mcp_McpService_getPrompt(
    env: JNIEnv,
    _class: JClass,
    prompt_id: JString,
) -> jstring {
    // ... logic to call the server and get the prompt ...
    let output = env.new_string("...prompt content...").unwrap();
    output.into_raw()
}
```

**Kotlin (`McpService.kt`):**

```kotlin
class McpService : Service() {
    // ... other service code ...

    external fun getPrompt(promptId: String): String

    fun fetchPromptAsync(promptId: String): Deferred<String> {
        return scope.async {
            getPrompt(promptId)
        }
    }

    // ...
}
```

## 🚀 Step-by-Step Integration

1.  **Initialize the Service:** The native service, including its Tokio runtime for asynchronous operations, must be initialized when your Android service starts.

    ```kotlin
    // In McpService.kt
    override fun onCreate() {
        super.onCreate()
        initTokioRuntime() // Starts the Rust async runtime
    }
    ```

2.  **Set the API Key (if required):** To avoid passing the API key on every call, set it once after initialization.

    ```kotlin
    // In McpService.kt or your Activity
    fun setApiKey(apiKey: String) {
        // This calls the corresponding external function
        setApiKeyNative(apiKey)
    }
    ```

3.  **Call a Native Method:** Use the wrapper functions in `McpService.kt` to call the native methods. Since these are blocking calls, they should always be run in a background coroutine.

    ```kotlin
    // In your MainActivity.kt or ViewModel
    fun onFetchPromptClicked() {
        lifecycleScope.launch {
            try {
                // The service handles running this on a background thread
                val promptContent = mcpService?.fetchPromptAsync("hello-world-prompt")?.await()
                // Update UI with promptContent
            } catch (e: Exception) {
                // Handle error
            }
        }
    }
    ```

4.  **Handle the Lifecycle:** Remember to shut down the native service when your Android service is destroyed to prevent memory leaks.

    ```kotlin
    // In McpService.kt
    override fun onDestroy() {
        destroyService() // Frees resources used by the Rust library
        super.onDestroy()
    }
    ```

## 📦 Building and Compiling

The Android project is configured to automatically compile the Rust code and include it in the final APK using the `org.mozilla.rust-android-gradle.rust-android` Gradle plugin.

To build the app, simply use the standard Android Studio build process or run `./gradlew assembleDebug` from the `android_app/android` directory (once `gradlew` is available). The Gradle plugin will handle invoking `cargo` to build the native library for the target architectures.
