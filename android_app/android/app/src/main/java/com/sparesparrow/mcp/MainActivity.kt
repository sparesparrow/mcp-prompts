package com.sparesparrow.mcp

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import androidx.appcompat.app.AppCompatActivity
import android.os.Bundle
import android.os.IBinder
import android.util.Log
import android.widget.Button
import android.widget.LinearLayout
import android.widget.Toast
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class MainActivity : AppCompatActivity() {

    private var mcpService: IMcpService? = null
    private var isBound = false
    private val scope = CoroutineScope(Dispatchers.Main)

    private val connection = object : ServiceConnection {
        override fun onServiceConnected(className: ComponentName, service: IBinder) {
            Log.d(TAG, "Service connected")
            // Cast the IBinder to our custom AIDL interface.
            mcpService = IMcpService.Stub.asInterface(service)
            isBound = true
            Toast.makeText(this@MainActivity, "MCP Native Service Connected", Toast.LENGTH_SHORT).show()
        }

        override fun onServiceDisconnected(arg0: ComponentName) {
            Log.d(TAG, "Service disconnected")
            isBound = false
            mcpService = null
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setupUI()
        // Bind to the service
        Intent(this, McpService::class.java).also { intent ->
            bindService(intent, connection, Context.BIND_AUTO_CREATE)
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        if (isBound) {
            unbindService(connection)
            isBound = false
        }
    }

    private fun setupUI() {
        val layout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
        }

        val listButton = Button(this).apply {
            text = "List Native Prompts"
            setOnClickListener {
                if (!isBound) return@setOnClickListener
                scope.launch(Dispatchers.IO) {
                    val prompts = mcpService?.listPrompts()
                    Log.i(TAG, "Native call listPrompts result: $prompts")
                    scope.launch(Dispatchers.Main) {
                        Toast.makeText(this@MainActivity, "Result: $prompts", Toast.LENGTH_LONG).show()
                    }
                }
            }
        }

        val getButton = Button(this).apply {
            text = "Get Native Prompt 'test-id'"
            setOnClickListener {
                if (!isBound) return@setOnClickListener
                 scope.launch(Dispatchers.IO) {
                    val prompt = mcpService?.getPrompt("test-id")
                    Log.i(TAG, "Native call getPrompt result: $prompt")
                    scope.launch(Dispatchers.Main) {
                        Toast.makeText(this@MainActivity, "Result: $prompt", Toast.LENGTH_LONG).show()
                    }
                }
            }
        }

        val setApiKeyButton = Button(this).apply {
            text = "Set API Key"
            setOnClickListener {
                if (!isBound) return@setOnClickListener
                scope.launch(Dispatchers.IO) {
                    // In a real app, get this from a secure source
                    mcpService?.setApiKey("DUMMY_API_KEY_12345")
                    scope.launch(Dispatchers.Main) {
                        Toast.makeText(this@MainActivity, "API Key Set", Toast.LENGTH_SHORT).show()
                    }
                }
            }
        }

        layout.addView(listButton)
        layout.addView(getButton)
        layout.addView(setApiKeyButton)
        setContentView(layout)
    }

    companion object {
        private const val TAG = "MainActivity"
    }
} 