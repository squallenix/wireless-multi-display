package com.example.aegisdisplay

import android.annotation.SuppressLint
import android.content.Context
import android.net.http.SslError
import android.os.Bundle
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.webkit.SslErrorHandler
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import androidx.activity.ComponentActivity
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat

class MainActivity : ComponentActivity() {

    private lateinit var webView: WebView
    private lateinit var configOverlay: LinearLayout
    private lateinit var ipInput: EditText
    private lateinit var portInput: EditText
    private lateinit var statusText: TextView

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Keep screen awake permanently while acting as a monitor
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        // Immersive sticky fullscreen (hide status bar & navigation buttons)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        val insetsController = WindowInsetsControllerCompat(window, window.decorView)
        insetsController.hide(WindowInsetsCompat.Type.systemBars())
        insetsController.systemBarsBehavior =
            WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE

        val rootLayout = FrameLayout(this).apply {
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
            setBackgroundColor(0xFF0D1117.toInt())
        }

        // 1. Hardware-Accelerated WebView
        webView = WebView(this).apply {
            layoutParams = FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
            setLayerType(View.LAYER_TYPE_HARDWARE, null)
            setBackgroundColor(0xFF000000.toInt())

            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                mediaPlaybackRequiresUserGesture = false
                allowFileAccess = true
                useWideViewPort = true
                loadWithOverviewMode = true
                setSupportZoom(false)
                builtInZoomControls = false
                displayZoomControls = false
                cacheMode = WebSettings.LOAD_DEFAULT
            }

            webChromeClient = WebChromeClient()
            webViewClient = object : WebViewClient() {
                @SuppressLint("WebViewClientOnReceivedSslError")
                override fun onReceivedSslError(
                    view: WebView?,
                    handler: SslErrorHandler?,
                    error: SslError?
                ) {
                    // Silently approve local LAN self-signed certificate for seamless connection
                    handler?.proceed()
                }

                override fun onPageFinished(view: WebView?, url: String?) {
                    super.onPageFinished(view, url)
                    configOverlay.visibility = View.GONE
                }

                override fun onReceivedError(
                    view: WebView?,
                    errorCode: Int,
                    description: String?,
                    failingUrl: String?
                ) {
                    statusText.text = "Connection error: $description\nCheck Host PC IP and Wi-Fi."
                    configOverlay.visibility = View.VISIBLE
                }
            }
        }
        rootLayout.addView(webView)

        // 2. Floating Config Button (Gear icon in top right)
        val btnConfig = Button(this).apply {
            text = "⚙️"
            textSize = 16f
            setBackgroundColor(0x33FFFFFF)
            setTextColor(0xFFFFFFFF.toInt())
            layoutParams = FrameLayout.LayoutParams(120, 100).apply {
                gravity = android.view.Gravity.TOP or android.view.Gravity.END
                setMargins(0, 16, 16, 0)
            }
            setOnClickListener {
                configOverlay.visibility = if (configOverlay.visibility == View.VISIBLE) View.GONE else View.VISIBLE
            }
        }
        rootLayout.addView(btnConfig)

        // 3. Setup / Connect Overlay
        val prefs = getSharedPreferences("aegis_prefs", Context.MODE_PRIVATE)
        val savedIp = prefs.getString("host_ip", "192.168.10.3") ?: "192.168.10.3"
        val savedPort = prefs.getString("host_port", "8443") ?: "8443"

        configOverlay = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = android.view.Gravity.CENTER
            setBackgroundColor(0xEE0D1117.toInt())
            setPadding(48, 48, 48, 48)
            layoutParams = FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )

            val title = TextView(context).apply {
                text = "🖥️ AegisDisplay Wireless Monitor"
                textSize = 20f
                setTextColor(0xFF58A6FF.toInt())
                setPadding(0, 0, 0, 24)
                gravity = android.view.Gravity.CENTER
            }
            addView(title)

            ipInput = EditText(context).apply {
                hint = "Host PC IP (e.g. 192.168.10.3)"
                setText(savedIp)
                setTextColor(0xFFFFFFFF.toInt())
                setHintTextColor(0xFF8B949E.toInt())
                setBackgroundColor(0xFF161B22.toInt())
                setPadding(24, 20, 24, 20)
            }
            addView(ipInput)

            portInput = EditText(context).apply {
                hint = "Port (default: 8443)"
                setText(savedPort)
                setTextColor(0xFFFFFFFF.toInt())
                setHintTextColor(0xFF8B949E.toInt())
                setBackgroundColor(0xFF161B22.toInt())
                setPadding(24, 20, 24, 20)
            }
            addView(portInput)

            val btnConnect = Button(context).apply {
                text = "Connect to PC"
                setBackgroundColor(0xFF238636.toInt())
                setTextColor(0xFFFFFFFF.toInt())
                setPadding(0, 20, 0, 20)
                setOnClickListener {
                    val host = ipInput.text.toString().trim()
                    val port = portInput.text.toString().trim()
                    if (host.isNotEmpty() && port.isNotEmpty()) {
                        prefs.edit().putString("host_ip", host).putString("host_port", port).apply()
                        statusText.text = "Connecting to https://$host:$port..."
                        webView.loadUrl("https://$host:$port/")
                    }
                }
            }
            addView(btnConnect)

            statusText = TextView(context).apply {
                text = "Make sure your phone and PC are on the same Wi-Fi."
                setTextColor(0xFF8B949E.toInt())
                textSize = 12f
                setPadding(0, 24, 0, 0)
                gravity = android.view.Gravity.CENTER
            }
            addView(statusText)
        }
        rootLayout.addView(configOverlay)

        setContentView(rootLayout)

        // Automatically connect on launch if saved IP exists
        if (savedIp.isNotEmpty()) {
            webView.loadUrl("https://$savedIp:$savedPort/")
        }
    }

    override fun onBackPressed() {
        if (configOverlay.visibility == View.GONE) {
            configOverlay.visibility = View.VISIBLE
        } else {
            super.onBackPressed()
        }
    }
}
