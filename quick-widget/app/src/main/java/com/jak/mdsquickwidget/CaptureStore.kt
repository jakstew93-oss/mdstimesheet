package com.jak.mdsquickwidget

import android.content.Context
import android.util.AtomicFile
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.FileNotFoundException
import java.util.UUID

object CaptureStore {
    private fun file(context: Context) = AtomicFile(File(context.filesDir, "quick-captures-v1.json"))
    @Synchronized fun read(context: Context): List<CaptureRun> {
        val source = try { file(context).openRead().bufferedReader().use { it.readText() } }
        catch (_: FileNotFoundException) { return emptyList() }
        val array = JSONArray(source)
        return (0 until array.length()).map { i ->
            val run = array.getJSONObject(i)
            val times = run.getJSONArray("times")
            require(times.length() in 1..4)
            CaptureRun(run.getString("id"), (0 until times.length()).map { j ->
                val time = times.getJSONObject(j)
                CaptureTime(time.getLong("epochMillis"), time.getInt("offsetSeconds"))
            })
        }
    }
    fun json(run: CaptureRun): JSONObject = JSONObject().put("id", run.id).put("times", JSONArray().apply {
        run.times.forEach { put(JSONObject().put("epochMillis", it.epochMillis).put("offsetSeconds", it.offsetSeconds)) }
    })
    private fun write(context: Context, runs: List<CaptureRun>) {
        val data = JSONArray().apply { runs.forEach { put(json(it)) } }.toString().toByteArray(Charsets.UTF_8)
        val target = file(context)
        val stream = target.startWrite()
        try { stream.write(data); target.finishWrite(stream) }
        catch (error: Exception) { target.failWrite(stream); throw error }
    }
    @Synchronized fun append(context: Context, tap: CaptureTime) {
        write(context, CaptureRun.append(read(context), tap) { UUID.randomUUID().toString() })
    }
}
