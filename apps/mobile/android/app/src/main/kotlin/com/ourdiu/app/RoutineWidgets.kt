package com.ourdiu.app

import android.app.AlarmManager
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.BroadcastReceiver
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.util.SizeF
import android.view.View
import android.widget.RemoteViews
import org.json.JSONObject
import java.util.Calendar
import java.util.TimeZone

// The Class Routine's home-screen widget (docs/PLAN.md, decisions 35 and 36): the
// app hands over the saved routine's week (`save`), and the widget works out the
// class on now and the next one itself, so it stays right offline and between app
// visits. Small, it's the class on now or the next one; stretched wide, the day's
// classes. Each draw schedules the next one for the next class's start or end.

class RoutineWidget : AppWidgetProvider() {
    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) =
        RoutineWidgets.refresh(context)

    /** Resized: before Android 12 the widget picks its layout itself. */
    override fun onAppWidgetOptionsChanged(
        context: Context,
        manager: AppWidgetManager,
        id: Int,
        options: Bundle,
    ) = RoutineWidgets.refresh(context)
}

/** Redraws the widget when a class starts or ends, and when the clock changes. */
class RoutineWidgetTick : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) = RoutineWidgets.refresh(context)
}

object RoutineWidgets {
    /** The widget opens the app on Today. */
    const val ACTION_OPEN = "com.ourdiu.app.OPEN_ROUTINE"

    private const val PREFS = "routine_widget"
    private const val KEY = "week"
    private val DAYS = listOf("SAT", "SUN", "MON", "TUE", "WED", "THU", "FRI")
    private val DAY_NAMES =
        listOf("Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday")

    /** The saved routine's week as the app describes it; null when nothing's saved. */
    fun save(context: Context, json: String?) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().apply {
            if (json == null) remove(KEY) else putString(KEY, json)
        }.apply()
        refresh(context)
    }

    private data class Class(
        val day: Int,
        val start: Int,
        val end: Int,
        val course: String,
        val who: String?,
        val room: String,
        val lab: Boolean,
    )

    private data class Week(val label: String, val version: String, val classes: List<Class>)

    private fun read(context: Context): Week? {
        val json = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY, null)
            ?: return null
        return try {
            val o = JSONObject(json)
            val list = o.getJSONArray("classes")
            Week(
                label = o.getString("label"),
                version = o.optString("version"),
                classes = (0 until list.length()).map { i ->
                    val c = list.getJSONObject(i)
                    Class(
                        day = DAYS.indexOf(c.getString("day")),
                        start = minutes(c.getString("start")),
                        end = minutes(c.getString("end")),
                        course = c.getString("course"),
                        who = if (c.isNull("who")) null else c.optString("who").ifBlank { null },
                        room = c.getString("room"),
                        lab = c.optBoolean("lab"),
                    )
                }.sortedWith(compareBy({ it.day }, { it.start })),
            )
        } catch (e: Exception) {
            android.util.Log.w("ClassRoutine", "Couldn't read the widget's week", e)
            null
        }
    }

    private fun minutes(time: String): Int {
        val (h, m) = time.split(":").map { it.toInt() }
        return h * 60 + m
    }

    /** "1:00 pm" */
    private fun clock(minutes: Int): String {
        val h = minutes / 60
        return "${if (h % 12 == 0) 12 else h % 12}:${"%02d".format(minutes % 60)} ${if (h < 12) "am" else "pm"}"
    }

    /** "1:00", for rows. */
    private fun short(minutes: Int): String {
        val h = minutes / 60
        return "${if (h % 12 == 0) 12 else h % 12}:${"%02d".format(minutes % 60)}"
    }

    /** The day of the university week (Saturday 0) and minute, in Dhaka. */
    private data class Now(val day: Int, val minutes: Int, val calendar: Calendar)

    private fun now(): Now {
        val c = Calendar.getInstance(TimeZone.getTimeZone("Asia/Dhaka"))
        // Calendar: Sunday 1 … Saturday 7; the university week starts Saturday.
        val day = c.get(Calendar.DAY_OF_WEEK) % 7
        return Now(day, c.get(Calendar.HOUR_OF_DAY) * 60 + c.get(Calendar.MINUTE), c)
    }

    /** The next class to start after now, and how many days ahead (0 today). */
    private fun next(classes: List<Class>, now: Now): Pair<Class, Int>? =
        classes.map { c ->
            var ahead = ((c.day - now.day + 7) % 7) * 1440 + c.start - now.minutes
            if (ahead <= 0) ahead += 7 * 1440
            c to ahead
        }.minByOrNull { it.second }?.let { (c, ahead) -> c to (now.minutes + ahead) / 1440 }

    private fun dayWord(day: Int, ahead: Int) = when (ahead) {
        0 -> "Today"
        1 -> "Tomorrow"
        else -> DAY_NAMES[day]
    }

    /** The day a list shows: today while a class is still to come, else the next class's. */
    private fun shownDay(week: Week, now: Now): Pair<Int, Int> {
        val todayLeft = week.classes.any { it.day == now.day && it.end > now.minutes }
        if (todayLeft) return now.day to 0
        val n = next(week.classes, now) ?: return now.day to 0
        return n.first.day to n.second
    }

    /** From this width (dp) the widget lists the day's classes. */
    private const val LIST_WIDTH = 220f

    fun refresh(context: Context) {
        val manager = AppWidgetManager.getInstance(context)
        val week = read(context)
        val now = now()
        val ids = manager.getAppWidgetIds(ComponentName(context, RoutineWidget::class.java))
        for (id in ids) {
            fun small() = nowViews(context, week, now).also {
                it.setOnClickPendingIntent(R.id.routine_widget_root, openApp(context))
            }
            fun wide() = listViews(context, week, now).also {
                it.setOnClickPendingIntent(R.id.routine_widget_root, openApp(context))
            }
            val views = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                // The launcher shows the largest that fits, as the widget is resized.
                RemoteViews(mapOf(SizeF(100f, 100f) to small(), SizeF(LIST_WIDTH, 100f) to wide()))
            } else {
                val width = manager.getAppWidgetOptions(id)
                    .getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH)
                if (width >= LIST_WIDTH) wide() else small()
            }
            manager.updateAppWidget(id, views)
        }
        schedule(context, week, now)
    }

    private fun nowViews(context: Context, week: Week?, now: Now): RemoteViews {
        val views = RemoteViews(context.packageName, R.layout.routine_widget_now)
        fun show(eyebrow: String, big: String, line: String) {
            views.setTextViewText(R.id.routine_widget_eyebrow, eyebrow)
            views.setTextViewText(R.id.routine_widget_big, big)
            views.setTextViewText(R.id.routine_widget_line, line)
        }
        if (week == null) {
            show("Class Routine", "Pick your routine", "Open the app and make a section or a teacher's week yours.")
            return views
        }
        val todays = week.classes.filter { it.day == now.day }
        val current = todays.firstOrNull { now.minutes >= it.start && now.minutes < it.end }
        val next = next(week.classes, now)
        fun where(c: Class) = listOfNotNull(c.room, c.who).joinToString(" · ")
        when {
            current != null -> show("Now · until ${clock(current.end)}", current.course, where(current))
            next != null && next.second == 0 ->
                show("Next · at ${clock(next.first.start)}", next.first.course, where(next.first))
            next != null -> show(
                if (todays.isEmpty()) "No classes today" else "Done for today",
                "${dayWord(next.first.day, next.second)} ${clock(next.first.start)}",
                "${next.first.course} · ${where(next.first)}",
            )
            else -> show(week.label, "No classes", "This routine has no classes.")
        }
        return views
    }

    private fun listViews(context: Context, week: Week?, now: Now): RemoteViews {
        val views = RemoteViews(context.packageName, R.layout.routine_widget_list)
        views.removeAllViews(R.id.routine_widget_rows)
        if (week == null) {
            views.setTextViewText(R.id.routine_widget_title, "Class Routine")
            views.setTextViewText(R.id.routine_widget_note, "")
            views.setViewVisibility(R.id.routine_widget_empty, View.VISIBLE)
            views.setTextViewText(
                R.id.routine_widget_empty,
                "Open the app and make a section or a teacher's week yours: its classes show here.",
            )
            return views
        }
        val (day, ahead) = shownDay(week, now)
        val onDay = week.classes.filter { it.day == day }
        views.setTextViewText(R.id.routine_widget_title, "${dayWord(day, ahead)} · ${week.label}")
        views.setTextViewText(
            R.id.routine_widget_note,
            if (onDay.size == 1) "1 class" else "${onDay.size} classes",
        )

        views.setViewVisibility(R.id.routine_widget_empty, if (onDay.isEmpty()) View.VISIBLE else View.GONE)
        views.setTextViewText(R.id.routine_widget_empty, "No classes. Enjoy the day off.")
        for (c in onDay) {
            val row = RemoteViews(context.packageName, R.layout.routine_widget_row)
            val today = ahead == 0
            val on = today && now.minutes >= c.start && now.minutes < c.end
            val over = today && now.minutes >= c.end
            row.setTextViewText(R.id.routine_widget_row_time, if (on) "Now" else short(c.start))
            row.setTextViewText(
                R.id.routine_widget_row_course,
                listOfNotNull(c.course, c.who).joinToString(" · "),
            )
            row.setTextViewText(R.id.routine_widget_row_room, c.room)
            when {
                on -> {
                    row.setInt(R.id.routine_widget_row, "setBackgroundResource", R.drawable.routine_widget_row_now)
                    val color = context.getColor(R.color.routine_widget_on_container)
                    row.setTextColor(R.id.routine_widget_row_time, color)
                    row.setTextColor(R.id.routine_widget_row_course, color)
                    row.setTextColor(R.id.routine_widget_row_room, color)
                }
                over -> row.setTextColor(
                    R.id.routine_widget_row_course,
                    context.getColor(R.color.routine_widget_muted),
                )
            }
            views.addView(R.id.routine_widget_rows, row)
        }
        return views
    }

    private fun openApp(context: Context): PendingIntent = PendingIntent.getActivity(
        context,
        0,
        Intent(context, MainActivity::class.java)
            .setAction(ACTION_OPEN)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP),
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

    /**
     * The next draw: when a class starts or ends today, else just after midnight in
     * Dhaka. Inexact (no exact-alarm permission), so it may come a minute late.
     */
    private fun schedule(context: Context, week: Week?, now: Now) {
        val alarms = context.getSystemService(AlarmManager::class.java) ?: return
        val tick = PendingIntent.getBroadcast(
            context,
            0,
            Intent(context, RoutineWidgetTick::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        alarms.cancel(tick)
        if (week == null) return
        val boundaries = week.classes.filter { it.day == now.day }
            .flatMap { listOf(it.start, it.end) }
            .filter { it > now.minutes }
        val at = boundaries.minOrNull() ?: (24 * 60 + 1)
        val time = (now.calendar.clone() as Calendar).apply {
            set(Calendar.HOUR_OF_DAY, 0)
            set(Calendar.MINUTE, 0)
            set(Calendar.SECOND, 5)
            set(Calendar.MILLISECOND, 0)
            add(Calendar.MINUTE, at)
        }.timeInMillis
        alarms.set(AlarmManager.RTC, time, tick)
    }
}
