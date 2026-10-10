package com.jak.mdswatch

import org.json.JSONArray
import org.json.JSONObject
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.UUID

class WatchState(val json: JSONObject = JSONObject()) {
    init {
        if (!json.has("rows")) json.put("rows", JSONObject())
        if (!json.has("queue")) json.put("queue", JSONArray())
        if (!json.has("cursor")) json.put("cursor", 0)
    }
    val rows: JSONObject get() = json.getJSONObject("rows")
    val queue: JSONArray get() = json.getJSONArray("queue")
    val token: String get() = json.optString("token")
    val endpoint: String get() = json.optString("endpoint")
    val active: String get() = json.optString("active")
    val job: String get() = json.optString("job")
    private fun apply(op: JSONObject) {
        val id = op.getString("entryId")
        val row = rows.optJSONObject(id) ?: JSONObject()
        if (op.getString("kind") == "delete") rows.put(id, JSONObject().put("deleted", true))
        else if (!row.optBoolean("deleted")) {
            val changes = op.getJSONObject("changes")
            for (key in changes.keys()) row.put(key, changes.get(key))
            rows.put(id, row)
        }
    }
    fun begin(jobNumber: String) {
        require(jobNumber.trim().isNotEmpty() && jobNumber.trim().length <= 120)
        json.put("job", jobNumber.trim()).put("active", UUID.randomUUID().toString())
    }
    fun resume(id: String) {
        val row = rows.getJSONObject(id)
        require(!row.optBoolean("deleted"))
        json.put("active", id).put("job", row.optString("jobNumber"))
    }
    fun nextField(): String? {
        val row = rows.optJSONObject(active) ?: JSONObject()
        if (row.optBoolean("deleted")) return null
        return listOf("startTime", "timeOnSite", "timeOffSite", "endTime").firstOrNull { row.optString(it).isEmpty() }
    }
    fun tap(epochMillis: Long, zone: ZoneId = ZoneId.systemDefault()): String {
        require(job.isNotEmpty())
        if (active.isEmpty() || nextField() == null) begin(job)
        val field = nextField() ?: error("No active entry")
        val local = Instant.ofEpochMilli(epochMillis).atZone(zone)
        val row = rows.optJSONObject(active)
        val changes = JSONObject().put(field, local.format(DateTimeFormatter.ofPattern("HH:mm")))
        if (row == null) changes.put("date", local.toLocalDate().toString()).put("jobNumber", job).put("id", epochMillis).put("food", false).put("hol", false)
        // Keep each tap's original epoch/offset independently from HH:mm display fields.
        val times = JSONArray(row?.optJSONArray("watchTimestamps")?.toString() ?: "[]")
        if (times.length() < 4) times.put(JSONObject().put("epochMillis", epochMillis).put("offsetSeconds", local.offset.totalSeconds))
        changes.put("watchTimestamps", times)
        val op = JSONObject().put("id", UUID.randomUUID().toString()).put("entryId", active).put("kind", "patch").put("changes", changes)
        queue.put(op); apply(op)
        return field
    }
    fun batch(): JSONArray = JSONArray().also { result -> for (i in 0 until minOf(queue.length(), 50)) result.put(queue.getJSONObject(i)) }
    fun merge(response: JSONObject) {
        val operations = response.getJSONArray("operations")
        for (i in 0 until operations.length()) apply(operations.getJSONObject(i))
        val ack = response.getJSONArray("ack")
        val acknowledged = (0 until ack.length()).map { ack.getString(it) }.toSet()
        val remaining = JSONArray()
        for (i in 0 until queue.length()) {
            val op = queue.getJSONObject(i)
            if (op.getString("id") !in acknowledged) { remaining.put(op); apply(op) }
        }
        json.put("queue", remaining).put("cursor", response.getLong("cursor"))
    }
}
