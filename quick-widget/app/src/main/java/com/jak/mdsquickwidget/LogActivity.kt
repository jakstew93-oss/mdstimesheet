package com.jak.mdsquickwidget

import android.app.Activity
import android.app.TimePickerDialog
import android.graphics.Color
import android.os.Bundle
import android.text.InputType
import android.view.Gravity
import android.view.Window
import android.view.WindowManager
import android.widget.Button
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
        requestWindowFeature(Window.FEATURE_NO_TITLE)
        window.statusBarColor = Color.rgb(28, 30, 34)
        window.navigationBarColor = Color.WHITE
        window.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS)
        type = intent.getStringExtra(QuickWidgetProvider.EXTRA_TYPE) ?: "SET JOB"
        val prefs = getSharedPreferences(QuickWidgetProvider.PREFS, MODE_PRIVATE)
        val density = resources.displayMetrics.density
        fun dp(v: Int) = (v * density).toInt()

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(Color.rgb(248, 249, 250))
        }

        val header = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(22), dp(20), dp(22), dp(18))
            setBackgroundColor(Color.rgb(36, 39, 44))
        }
        header.addView(TextView(this).apply {
            text = if (type == "SET JOB") "Set Active Job" else "$type Log"
            textSize = 27f
            setTextColor(Color.WHITE)
            setTypeface(typeface, android.graphics.Typeface.BOLD)
        })
        header.addView(TextView(this).apply {
            text = if (type == "SET JOB") "Add a job number and confirm the time" else "Confirm the job number and log time"
            textSize = 14f
            setTextColor(Color.rgb(185, 188, 194))
            setPadding(0, dp(4), 0, 0)
        })
        root.addView(header)

        val content = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(22), dp(20), dp(22), dp(22))
        }

        content.addView(TextView(this).apply {
            text = "Job number"
            textSize = 16f
            setTextColor(Color.rgb(70, 73, 78))
            setTypeface(typeface, android.graphics.Typeface.BOLD)
        })
        jobInput = EditText(this).apply {
            hint = "Enter job number"
            textSize = 18f
            inputType = InputType.TYPE_CLASS_TEXT
            setText(prefs.getString("job", ""))
            setPadding(dp(12), dp(8), dp(12), dp(8))
        }
        content.addView(jobInput, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(56)).apply { topMargin = dp(6); bottomMargin = dp(22) })

        content.addView(TextView(this).apply {
            text = "Time"
            textSize = 16f
            setTextColor(Color.rgb(70, 73, 78))
            setTypeface(typeface, android.graphics.Typeface.BOLD)
        })
        timeText = TextView(this).apply {
            textSize = 25f
            setTextColor(Color.rgb(30, 32, 35))
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(14), 0, dp(14), 0)
            setBackgroundColor(Color.rgb(235, 237, 239))
            text = currentTimeLabel()
            setOnClickListener { chooseTime() }
        }
        content.addView(timeText, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(64)).apply { topMargin = dp(6) })
        content.addView(TextView(this).apply {
            text = "Tap to change the time"
            textSize = 13f
            setTextColor(Color.rgb(105, 108, 113))
            setPadding(dp(4), dp(5), 0, dp(20))
        })

        val save = Button(this).apply {
            text = if (type == "SET JOB") "SAVE JOB" else "LOG $type"
            textSize = 15f
            setTextColor(Color.WHITE)
            setBackgroundColor(Color.rgb(25, 103, 210))
            setOnClickListener { save() }
        }
        content.addView(save, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(58)))
        root.addView(content, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))
        setContentView(root)
    }

    private fun chooseTime() {
        TimePickerDialog(this, { _, h, m -> hour = h; minute = m; timeText.text = currentTimeLabel() }, hour, minute, true).show()
    }

    private fun currentTimeLabel() = "%02d:%02d".format(hour, minute)

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
