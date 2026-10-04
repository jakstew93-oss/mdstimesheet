# MDS Quick Log

The home-screen widget has one button. Each tap captures the phone clock immediately when Android delivers the tap, saves the timestamp atomically on the phone, and advances Start → On site → Off site → Finish. The next tap after Finish starts another set. There is no job-number prompt, picker, browser launch or network request while logging. All widget instances share one active set.

Install the APK, open **MDS Quick Log**, and tap **Add home-screen button**. Alternatively, long-press the Samsung home screen, choose Widgets, and add MDS Quick Log.

When ready, open MDS Quick Log from the app drawer and choose **Use in timesheet** for a recorded set. The website asks before filling an empty quick-entry draft. Sign in to the intended employee account, add job details and save as usual. Existing drafts are never replaced. Re-importing a saved set is detected by its capture ID. The app keeps the captured records on the phone after transfer.

The widget keeps epoch milliseconds and the UTC offset at each tap. Its confirmation shows seconds. Existing timesheet calculations and PDFs still use hours/minutes; the original tap timestamps are retained with saved entries. The transfer uses the URL fragment, which is not included in HTTP requests. No shared backend is used, so native-widget records do not appear automatically in browser storage.

Run `gradle testDebugUnitTest assembleDebug` from `quick-widget/`. The GitHub workflow builds an installable debug APK and runs the timestamp tests. Physical-device widget installation and launcher behaviour still require verification on the phone. Android dispatch can add a small delay between physical touch and receipt; timestamps are captured before file/UI work.
