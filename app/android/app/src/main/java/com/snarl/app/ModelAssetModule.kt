package com.snarl.app

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.File
import java.io.IOException

/**
 * Copies a model file bundled in the APK's assets into the app cache directory and returns its
 * absolute filesystem path. The inference library reads models through java.net.URL, which only
 * resolves real schemes (file://, http://); a bundled asset has no such path until it is extracted,
 * so it must be materialised on disk first.
 */
class ModelAssetModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = NAME

  @ReactMethod
  fun resolveModelPath(assetName: String, promise: Promise) {
    val context = reactApplicationContext
    val outFile = File(context.cacheDir, assetName)
    try {
      context.assets.open(assetName).use { input ->
        outFile.outputStream().use { output -> input.copyTo(output) }
      }
    } catch (error: IOException) {
      promise.reject("model_asset_extract_failed", "Could not extract $assetName", error)
      return
    }
    promise.resolve(outFile.absolutePath)
  }

  companion object {
    const val NAME = "ModelAsset"
  }
}
