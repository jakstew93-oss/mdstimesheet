package com.jak.mdsquickwidget

import android.app.Activity
import android.app.TimePickerDialog
import android.os.Bundle
import android.text.InputType
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import java.time.LocalTime
import java.time.format.DateTimeFormatter

class LogActivity : Activity() {
    private lateinit var jobInput: EditText
    private lateinit var timeText: TextView
    private var hour = LocalTime.now().hour
    private var minute = LocalTime.now().minute
    private lateinit var type: String

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        type = intent.getStringExtra(QuickWidgetProvider.EXTRA_TYPE) ?: "SET JOB"
        val prefs = getSharedPreferences(QuickWidgetProvider.PREFS, MODE_PRIVATE)

        val box = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(48, 40, 48, 32) }
        box.addView(TextView(this).apply { text = if (type == "SET JOB") "Set active job" else "$type log"; textSize = 22f })
        jobInput = EditText(this).apply { hint = "Job number"; inputType = InputType.TYPE_CLASS_TEXT; setText(prefs.getString("job", "")) }
        box.addView(jobInput)
        timeText = TextView(this).apply { textSize = 20f; setPadding(0, 30, 0, 30); text = currentTimeLabel(); setOnClickListener { chooseTime() } }
        box.addView(timeText)
        val save = android.widget.Button(this).apply { text = if (type == "SET JOB") "SAVE JOB" else "LOG $type"; setOnClickListener { save() } }
        box.addView(save)
        setContentView(box)
    }

    private fun chooseTime() {
        TimePickerDialog(this, { _, h, m -> hour = h; minute = m; timeText.text = currentTimeLabel() }, hour, minute, true).show()
    }

    private fun currentTimeLabel() = "Time: %02d:%02d  (tap to change)".format(hour, minute)

    private fun save() {
        val job = jobInput.text.toString().trim()
        if (job.isBlank()) { Toast.makeText(this, "Enter a job number", Toast.LENGTH_SHORT).show(); return }
        val prefs = getSharedPreferences(QuickWidgetProvider.PREFS, MODE_PRIVATE)
        val edit = prefs.edit().putString("job", job)
        if (type == "SET JOB") {
            edit.putInt("stage", 0).putString("status", "Job $job ready • TEST")
        } else {
            val time = LocalTime.of(hour, minute).format(DateTimeFormatter.ofPattern("HH:mm"))
            val nextStage = when(type) { "START" -> 1; "ON SITE" -> 2; "OFF SITE" -> 3; "FINISH" -> 3; else -> prefs.getInt("stage", 0) }
            edit.putInt("stage", nextStage).putString("status", "$type • $time • Job $job • TEST")
        }
        edit.apply()
        QuickWidgetProvider.refreshAll(this)
        finish()
    }
}
