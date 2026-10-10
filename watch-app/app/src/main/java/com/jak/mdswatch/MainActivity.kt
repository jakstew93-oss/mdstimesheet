package com.jak.mdswatch

import android.app.Activity
import android.app.AlertDialog
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.VibrationEffect
import android.os.Vibrator
import android.graphics.Color
import android.view.Gravity
import android.view.MotionEvent
import android.widget.*
import android.text.InputType
import org.json.JSONObject
import android.util.AtomicFile
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.time.LocalDate
import java.util.concurrent.Executors

class MainActivity : Activity() {
    private lateinit var state: WatchState
    private lateinit var file: AtomicFile
    private lateinit var content: LinearLayout
    private val handler = Handler(Looper.getMainLooper())
    private val executor = Executors.newSingleThreadExecutor()
    private var syncing = false
    private var message = ""
    private var lastTap = 0L
    private val labels = mapOf("startTime" to "Start time", "timeOnSite" to "On site", "timeOffSite" to "Off site", "endTime" to "Finish")
    private val poll = object : Runnable { override fun run() { sync(); handler.postDelayed(this, 15000) } }
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        file = AtomicFile(File(filesDir, "timesheet.json"))
        state = try { WatchState(JSONObject(file.openRead().bufferedReader().use { it.readText() })) }
        catch (_: java.io.FileNotFoundException) { WatchState() }
        catch (_: Exception) {
            // Never silently discard an unreadable offline queue.
            TextView(this).also { it.text = "Saved logs could not be read. Keep this app installed and recover its data before logging."; setContentView(it) }
            return
        }
        render()
    }
    override fun onResume() { super.onResume(); if (::state.isInitialized) { handler.post(poll) } }
    override fun onPause() { handler.removeCallbacks(poll); super.onPause() }
    override fun onDestroy() { handler.removeCallbacksAndMessages(null); executor.shutdown(); super.onDestroy() }
    private fun persist() {
        val output = file.startWrite()
        try { output.write(state.json.toString().toByteArray(Charsets.UTF_8)); file.finishWrite(output) }
        catch (e: Exception) { file.failWrite(output); throw e }
    }
    private fun text(value: String, size: Float = 16f) {
        content.addView(TextView(this).apply { text = value; textSize = size; setTextColor(Color.WHITE); gravity = Gravity.CENTER; setPadding(0, 8, 0, 8) })
    }
    private fun button(label: String, action: () -> Unit) {
        content.addView(Button(this).apply { text = label; isAllCaps = false; minHeight = 48; setOnClickListener { action() } })
    }
    private fun render() {
        if (isDestroyed || !::state.isInitialized) return
        val scroll = ScrollView(this)
        content = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(26, 40, 26, 40) }
        scroll.addView(content); setContentView(scroll)
        scroll.setOnGenericMotionListener { _, event ->
            if (event.action == MotionEvent.ACTION_SCROLL) { scroll.scrollBy(0, (-event.getAxisValue(MotionEvent.AXIS_SCROLL) * 48).toInt()); true } else false
        }
        text("MDS TIMESHEET", 17f)
        text(if (state.job.isEmpty()) "Choose a job" else "Job ${state.job}", 19f)
        text(message.ifEmpty { if (state.token.isEmpty()) "Pair to sync · offline logging available" else "${state.queue.length()} waiting to sync" }, 12f)
        val field = state.nextField()
        button(field?.let { labels[it] } ?: "Start next shift") {
            if (state.job.isEmpty()) { chooseJob(); return@button }
            val now = System.currentTimeMillis()
            if (android.os.SystemClock.elapsedRealtime() - lastTap < 1200) return@button
            val before = state.json.toString()
            try {
                val logged = state.tap(now)
                persist(); lastTap = android.os.SystemClock.elapsedRealtime()
                message = "${labels[logged]} saved · ${state.rows.getJSONObject(state.active).optString(logged)}"
                (getSystemService(VIBRATOR_SERVICE) as Vibrator).vibrate(VibrationEffect.createOneShot(70, VibrationEffect.DEFAULT_AMPLITUDE))
                render(); sync()
            } catch (_: Exception) { state = WatchState(JSONObject(before)); message = "Not saved · try again"; render() }
        }
        val row = state.rows.optJSONObject(state.active)
        if (row != null && !row.optBoolean("deleted")) for ((key, label) in labels) if (row.optString(key).isNotEmpty()) text("$label  ${row.optString(key)}", 14f)
        text(state.hoursSummary(LocalDate.now().toString()), 13f)
        button("Choose / change job") { chooseJob() }
        button("Today's entries") { entries() }
        button("Sync now") { sync() }
        button(if (state.token.isEmpty()) "Pair with phone" else "Connection") { pairing() }
    }
    private fun chooseJob() {
        val input = EditText(this).apply { hint = "Job number"; setText(state.job); inputType = InputType.TYPE_CLASS_TEXT }
        AlertDialog.Builder(this).setTitle("New job / shift").setMessage("Starts a new entry. Previous logs stay saved.").setView(input)
            .setPositiveButton("Use job") { _, _ ->
                try { state.begin(input.text.toString()); persist(); message = "Job selected"; render() } catch (_: Exception) { message = "Enter a job number (max 120 characters)"; render() }
            }.setNegativeButton("Cancel", null).show()
    }
    private fun entries() {
        val ids = state.rows.keys().asSequence().filter { id -> val row = state.rows.getJSONObject(id); !row.optBoolean("deleted") && row.optString("date") == LocalDate.now().toString() }.toList()
            .sortedBy { state.rows.getJSONObject(it).optString("startTime") }
        if (ids.isEmpty()) { AlertDialog.Builder(this).setMessage("No entries for today yet.").setPositiveButton("OK", null).show(); return }
        val names = ids.map { id -> val row = state.rows.getJSONObject(id); "${row.optString("jobNumber")} · ${row.optString("startTime", "—")}–${row.optString("endTime", "…")}" }.toTypedArray()
        AlertDialog.Builder(this).setTitle("Today's entries · tap to resume").setItems(names) { _, index -> state.resume(ids[index]); persist(); render() }.setNegativeButton("Close", null).show()
    }
    private fun pairing() {
        val form = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        val address = EditText(this).apply { hint = "Service HTTPS address"; setText(state.endpoint); inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_URI }
        val code = EditText(this).apply { hint = "8-digit phone code"; inputType = InputType.TYPE_CLASS_NUMBER }
        form.addView(address); form.addView(code)
        AlertDialog.Builder(this).setTitle("Pair your timesheet").setMessage("Get the code from Connect watch in your phone app. Offline logs will sync to the employee who generated this code.").setView(form)
            .setPositiveButton("Pair") { _, _ ->
                if (state.token.isNotEmpty()) {
                    message = "Keep this connection. Use this connection for the same employee. Do not clear app data while logs are waiting."; render(); return@setPositiveButton
                }
                try {
                    val uri = java.net.URI(address.text.toString().trim())
                    require(uri.scheme == "https" && !uri.host.isNullOrEmpty() && uri.rawUserInfo == null && uri.query == null && uri.fragment == null && (uri.path.isNullOrEmpty() || uri.path == "/"))
                    val endpoint = "https://${uri.rawAuthority}"
                    val pairingCode = code.text.toString()
                    message = "Pairing…"; render()
                    executor.execute {
                        try {
                            val response = request(endpoint, "", "/v1/redeem", JSONObject().put("code", pairingCode))
                            handler.post { state.json.put("endpoint", endpoint).put("token", response.getString("token")); persist(); message = "Paired"; render(); sync() }
                        } catch (_: Exception) { handler.post { message = "Pairing failed · check address and code"; render() } }
                    }
                } catch (_: Exception) { message = "Enter a valid HTTPS service address"; render() }
            }.setNegativeButton("Close", null).show()
    }
    private fun request(endpoint: String, token: String, path: String, body: JSONObject): JSONObject {
        val connection = URL(endpoint + path).openConnection() as HttpURLConnection
        connection.instanceFollowRedirects = false
        connection.requestMethod = "POST"; connection.connectTimeout = 15000; connection.readTimeout = 15000; connection.doOutput = true
        connection.setRequestProperty("Content-Type", "application/json")
        if (token.isNotEmpty()) connection.setRequestProperty("Authorization", "Bearer $token")
        try {
            connection.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
            if (connection.responseCode !in 200..299) error("Service unavailable")
            return JSONObject(connection.inputStream.bufferedReader().use { it.readText() })
        } finally { connection.disconnect() }
    }
    private fun sync() {
        if (syncing || state.token.isEmpty()) return
        syncing = true
        val body = JSONObject().put("operations", state.batch()).put("cursor", state.json.getLong("cursor"))
        val endpoint = state.endpoint; val token = state.token
        executor.execute {
            try {
                val response = request(endpoint, token, "/v1/sync", body)
                handler.post {
                    var saved = false
                    val before = state.json.toString()
                    try { state.merge(response); persist(); saved = true; message = if (state.queue.length() == 0) "Synced with phone" else "${state.queue.length()} waiting" }
                    catch (_: Exception) { state = WatchState(JSONObject(before)); message = "Sync could not be saved · retry" }
                    syncing = false; render()
                    if (saved && (response.optBoolean("more") || state.queue.length() > 0)) sync()
                }
            } catch (_: Exception) { handler.post { syncing = false; message = "Saved on watch · waiting to sync"; render() } }
        }
    }
}
