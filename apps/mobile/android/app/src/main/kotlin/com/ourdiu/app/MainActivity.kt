package com.ourdiu.app

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.OpenableColumns
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import java.io.File

/**
 * Also the target of "Share → QuestionBank" for PDFs: the shared file is copied
 * into the app's cache and handed to Flutter on the `diuqbank/shared_pdf`
 * channel, which asks for it at start ("take") and hears of later ones
 * ("shared").
 */
class MainActivity : FlutterActivity() {
    private var channel: MethodChannel? = null
    private var pending: Map<String, Any?>? = null

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        channel = MethodChannel(flutterEngine.dartExecutor.binaryMessenger, CHANNEL).apply {
            setMethodCallHandler { call, result ->
                if (call.method == "take") {
                    result.success(pending)
                    pending = null
                } else {
                    result.notImplemented()
                }
            }
        }
        pending = takeSharedPdf(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        takeSharedPdf(intent)?.let { channel?.invokeMethod("shared", it) }
    }

    /** The PDF an intent shares, copied where the app can read it; null if none. */
    private fun takeSharedPdf(intent: Intent?): Map<String, Any?>? {
        if (intent?.action != Intent.ACTION_SEND) return null
        val uri = sharedUri(intent) ?: return null
        // Handled once, even if the activity is recreated with the same intent.
        intent.action = null
        var name = "Shared paper.pdf"
        return try {
            var size = -1L
            contentResolver.query(uri, null, null, null, null)?.use { cursor ->
                if (cursor.moveToFirst()) {
                    val nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                    val sizeIndex = cursor.getColumnIndex(OpenableColumns.SIZE)
                    if (nameIndex >= 0) cursor.getString(nameIndex)?.let { name = it }
                    if (sizeIndex >= 0 && !cursor.isNull(sizeIndex)) size = cursor.getLong(sizeIndex)
                }
            }
            // Too big to upload: Flutter only needs the size to say so.
            if (size > MAX_BYTES) return mapOf("path" to null, "name" to name, "size" to size)
            val dir = File(cacheDir, "shared").apply {
                deleteRecursively()
                mkdirs()
            }
            val file = File(dir, name.replace(Regex("""[\\/:*?"<>|]"""), "").ifBlank { "Shared paper.pdf" })
            contentResolver.openInputStream(uri)?.use { input ->
                file.outputStream().use { input.copyTo(it) }
            } ?: throw IllegalStateException("No stream for $uri")
            mapOf("path" to file.path, "name" to name, "size" to file.length())
        } catch (e: Exception) {
            // Flutter says it couldn't open the file.
            android.util.Log.w("QuestionBank", "Couldn't read a shared PDF", e)
            mapOf("path" to null, "name" to name, "size" to -1L)
        }
    }

    private fun sharedUri(intent: Intent): Uri? =
        if (Build.VERSION.SDK_INT >= 33) {
            intent.getParcelableExtra(Intent.EXTRA_STREAM, Uri::class.java)
        } else {
            @Suppress("DEPRECATION")
            intent.getParcelableExtra(Intent.EXTRA_STREAM)
        }

    companion object {
        private const val CHANNEL = "diuqbank/shared_pdf"

        /** Past the API's 20 MB limit, with room for rounding. */
        private const val MAX_BYTES = 21L * 1024 * 1024
    }
}
