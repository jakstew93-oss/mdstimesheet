# MDS Quick Log

The home-screen widget has one button. Each tap captures the phone clock immediately when Android delivers the tap, saves the timestamp atomically on the phone, and advances Start → On site → Off site → Finish. The next tap after Finish starts another set. There is no job-number prompt, picker, browser launch or network request while logging. All widget instances share one active set.

Install the APK, open **MDS Quick Log 2**, and tap **Add home-screen button**. Alternatively, long-press the Samsung home screen, choose Widgets, and add MDS Quick Log.

When ready, open MDS Quick Log from the app drawer and choose **Use in installed MDS app** for a recorded set. Quick Log locates the Chrome-installed MDS WebAPK by its start URL and launches its matching activity explicitly. It does not fall back to a browser. If Chrome created only a home-screen shortcut, choose **Copy times for MDS app**, open the existing MDS home-screen icon, and use **Import widget times** to paste. The website asks before filling an empty quick-entry draft. Sign in to the intended employee account, add job details and save as usual. Existing drafts are never replaced. Re-importing a saved set is detected by its capture ID. The app keeps the captured records on the phone after transfer.

The widget keeps epoch milliseconds and the UTC offset at each tap. Its confirmation shows seconds. Existing timesheet calculations and PDFs still use hours/minutes; the original tap timestamps are retained with saved entries. The transfer uses the URL fragment, which is not included in HTTP requests. No shared backend is used, so native-widget records do not appear automatically in browser storage.

Run `gradle testDebugUnitTest assembleDebug` from `quick-widget/`. The GitHub workflow builds an installable debug APK and runs the timestamp tests. Physical-device widget installation and launcher behaviour still require verification on the phone. Android dispatch can add a small delay between physical touch and receipt; timestamps are captured before file/UI work.

Version 1.5 installs as **MDS Quick Log 2**, alongside version 1.4. The earlier CI debug APK used a disposable signing key, so it cannot be updated in place with a differently signed APK. Keep the old app while any recorded times are still needed. This version uses a separate application ID; CI caches its signing key for later updates.

## Galaxy Watch (Wear OS)

Version 1.6 adds **MDS Log** for Wear OS watches such as the Galaxy Watch 8 Classic. It records the same four stages (Start → On site → Off site → Finish) from a tile or the app's big round button, buzzes to confirm, and sends each set to MDS Quick Log on the phone over the watch's normal Bluetooth link. When Finish is tapped the phone shows **Day recorded on watch**; tapping it opens the installed MDS app with those times, using the same import as the widget. Watch sets are marked ⌚ in Quick Log and are kept separate from widget sets.

Taps always log against the current day. A set left unfinished for 18 hours or more is treated as forgotten, so the next tap starts today's set; a shift that runs past midnight still finishes normally.

The watch app has the same application ID as the phone app and must be signed with the same key. Builds sign both with the key stored in the `MDS_SIGNING_KEYSTORE` repository secret (a base64 PKCS12 keystore, alias `mds`), so later builds install over earlier ones. Without the secret the workflow warns and falls back to a throwaway debug key; then install both APKs from the same run. Download them from the run's artifacts `mds-quick-widget-test` and `mds-watch-log`.

Installing on the watch (one-off):
1. On the watch: Settings → About watch → Software information → tap **Software version** seven times to turn on Developer options.
2. Settings → Developer options → turn on **ADB debugging** and **Wireless debugging** (watch and phone on the same Wi-Fi).
3. Install `wear-debug.apk` with a phone app such as Bugjaeger or Easy Fire Tools (pair using the code shown under Wireless debugging), or from a computer with `adb pair`, `adb connect` and `adb install wear-debug.apk`.
4. On the watch, long-press the watch face → Tiles → add **MDS Log**.
