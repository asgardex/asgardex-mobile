package org.thorchain.asgardex

import android.os.Bundle
import android.webkit.WebView
import androidx.activity.enableEdgeToEdge

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    // Enable WebView debugging for Chrome DevTools (chrome://inspect) only in debug builds.
    if (BuildConfig.DEBUG) {
      WebView.setWebContentsDebuggingEnabled(true)
    }
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
  }
}
