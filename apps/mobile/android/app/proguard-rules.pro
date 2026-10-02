# ML Kit's document scanner finds its parts at runtime (component registrars and
# reflection). Without these rules R8 strips them from release builds and the
# scanner fails to start: MlKitContext returns no SharedPrefManager, so
# GmsDocumentScanning.getClient() throws a NullPointerException.
-keep class com.google.mlkit.** { *; }
-keep class com.google.android.gms.internal.mlkit_vision_document_scanner.** { *; }
-keep class com.google.firebase.components.** { *; }
