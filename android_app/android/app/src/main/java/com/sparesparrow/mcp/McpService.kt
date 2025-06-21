package com.sparesparrow.mcp

import android.app.Service
import android.content.Intent
import android.os.IBinder
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build
import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import java.io.File
import java.io.FileOutputStream
import java.io.InputStream

class McpService : Service() {

    private var nativeBinder: IBinder? = null
    private val serviceJob = Job()
    private val serviceScope = CoroutineScope(Dispatchers.IO + serviceJob)

    companion object {
        const val NOTIFICATION_CHANNEL_ID = "McpServiceChannel"
        private const val TAG = "McpService"
        private const val BINARY_NAME = "mcp-prompts-rs"
        private const val NATIVE_LIB_NAME = "mcp_native_service"
    }

    init {
        Log.d(TAG, "Loading native library: $NATIVE_LIB_NAME")
        System.loadLibrary(NATIVE_LIB_NAME)
        Log.d(TAG, "Native library loaded.")
    }

    private external fun make_mcp_service(): IBinder
    private external fun init_tokio_runtime()
    private external fun destroy_service(binder: IBinder)

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        val notification = createNotification()
        startForeground(1, notification)
        
        serviceScope.launch {
            Log.d(TAG, "Initializing Tokio runtime...")
            init_tokio_runtime()
            Log.d(TAG, "Creating native MCP service binder.")
            nativeBinder = make_mcp_service()
            Log.d(TAG, "Native binder created.")
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        // We no longer need to manage a process.
        // The service can be a simple bound service.
        // If we still wanted a foreground service, the notification logic would remain.
        return START_NOT_STICKY
    }

    override fun onDestroy() {
        super.onDestroy()
        serviceJob.cancel()
        nativeBinder?.let {
            Log.d(TAG, "Destroying native service.")
            destroy_service(it)
        }
        Log.d(TAG, "McpService destroyed.")
        // In a real implementation, we would need a native method
        // to drop the binder object and free the memory.
    }

    override fun onBind(intent: Intent): IBinder? {
        Log.d(TAG, "Returning native binder.")
        return nativeBinder
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val serviceChannel = NotificationChannel(
                NOTIFICATION_CHANNEL_ID,
                "MCP Server",
                NotificationManager.IMPORTANCE_DEFAULT
            )
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(serviceChannel)
        }
    }

    private fun createNotification(): Notification {
        // Simple notification to keep the service in the foreground.
        return Notification.Builder(this, NOTIFICATION_CHANNEL_ID)
            .setContentTitle("MCP Prompts Server")
            .setContentText("Server is running in the background.")
            // .setSmallIcon(R.drawable.ic_notification) // Requires an icon resource
            .build()
    }
} 