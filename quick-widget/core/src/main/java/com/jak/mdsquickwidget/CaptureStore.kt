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
        return (0 until array.length()).map { fromJson(array.getJSONObject(it)) }
    }
    fun fromJson(run: JSONObject): CaptureRun {
        val times = run.getJSONArray("times")
        require(times.length() in 1..4)
        return CaptureRun(run.getString("id"), (0 until times.length()).map { j ->
            val time = times.getJSONObject(j)
            CaptureTime(time.getLong("epochMillis"), time.getInt("offsetSeconds"))
        }, run.optString("source", CaptureRun.PHONE))
    }
    fun json(run: CaptureRun): JSONObject = JSONObject().put("id", run.id).put("times", JSONArray().apply {
        run.times.forEach { put(JSONObject().put("epochMillis", it.epochMillis).put("offsetSeconds", it.offsetSeconds)) }
    }).apply { if (run.source != CaptureRun.PHONE) put("source", run.source) }
    private fun write(context: Context, runs: List<CaptureRun>) {
        val data = JSONArray().apply { runs.forEach { put(json(it)) } }.toString().toByteArray(Charsets.UTF_8)
        val target = file(context)
        val stream = target.startWrite()
        try { stream.write(data); target.finishWrite(stream) }
        catch (error: Exception) { target.failWrite(stream); throw error }
    }
    /** Records [tap] and returns the set it was added to. */
    @Synchronized fun append(context: Context, tap: CaptureTime, source: String = CaptureRun.PHONE): CaptureRun {
        val runs = CaptureRun.append(read(context), tap, source) { UUID.randomUUID().toString() }
        write(context, runs)
        return runs.last { it.source == source && it.times.last() == tap }
    }
    /** Saves a set from the watch and returns the copy that was there before, if any. */
    @Synchronized fun upsert(context: Context, run: CaptureRun): CaptureRun? {
        val (runs, before) = CaptureRun.upsert(read(context), run)
        write(context, runs)
        return before
    }
}
