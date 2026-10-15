# MDS Timesheet Android app

**MDS Timesheet** is the timesheet web app (https://jakstew93-oss.github.io/mdstimesheet/) in its own Android app, for people who want watch logging. Everyone else keeps using the web app. The app loads the live web app, so web changes reach it straight away and it still works offline.

Inside the app:
- Watch taps (MDS Log tile) and widget taps go straight into Quick Start as they happen (`native-bridge.js` pulls them from the app every few seconds). When Finish is tapped on the watch, a notification opens the app.
- Downloads (CSV, PDFs, backups) save to Downloads/MDS Timesheet, sharing uses Android's share menu, receipt photos use the camera or gallery, and the weather card can use location.
- **Moving data in:** the app has its own storage, separate from Chrome. In the web app open Export → **Back up or move your data** → Download backup, then in the app use **Restore from a backup**.
- **Updates:** every signed build from `main` is published as a GitHub release (`app-v<version>`, with `mds-timesheet.apk` and `mds-watch.apk`). The app checks the latest release each time it opens and offers to install it; Export → MDS Timesheet app → Check for updates checks on demand. Android asks once to allow the app to install updates.

The first install is from the latest release on GitHub. The app replaces MDS Quick Log 2 (same app ID), which must be uninstalled first because it was signed with a different key.

## Home-screen widget

The home-screen widget has one button. Each tap captures the phone clock immediately when Android delivers the tap, saves the timestamp atomically on the phone, and advances Start → On site → Off site → Finish. The next tap after Finish starts another set. There is no job-number prompt, picker, browser launch or network request while logging. All widget instances share one active set.

Long-press the Samsung home screen, choose Widgets, and add MDS Timesheet. Widget taps go straight into the app's Quick Start.


The widget keeps epoch milliseconds and the UTC offset at each tap. Its confirmation shows seconds. Existing timesheet calculations and PDFs still use hours/minutes; the original tap timestamps are retained with saved entries. The transfer uses the URL fragment, which is not included in HTTP requests. No shared backend is used, so native-widget records do not appear automatically in browser storage.

Run `gradle testDebugUnitTest assembleDebug` from `quick-widget/`. The GitHub workflow runs the tests and builds `mds-timesheet.apk` and `mds-watch.apk`, signed with the `MDS_SIGNING_KEYSTORE` secret. Physical-device widget installation and launcher behaviour still require verification on the phone. Android dispatch can add a small delay between physical touch and receipt; timestamps are captured before file/UI work.


## Galaxy Watch (Wear OS)

Version 1.6 adds **MDS Log** for Wear OS watches such as the Galaxy Watch 8 Classic. It records the same four stages (Start → On site → Off site → Finish) from a tile or the app's big round button, buzzes to confirm, and sends each set to the MDS Timesheet app on the phone over the watch's normal Bluetooth link, where it appears in Quick Start. When Finish is tapped the phone shows **Day recorded on watch**. Watch sets are kept separate from widget sets.

Taps always log against the current day. A set left unfinished for 18 hours or more is treated as forgotten, so the next tap starts today's set; a shift that runs past midnight still finishes normally.

The watch app has the same application ID as the phone app and must be signed with the same key. Builds sign both with the key stored in the `MDS_SIGNING_KEYSTORE` repository secret (a base64 PKCS12 keystore, alias `mds`), so later builds install over earlier ones. Without the secret the workflow warns and falls back to a throwaway debug key; then install both APKs from the same run. Download them from the run's artifacts `mds-quick-widget-test` and `mds-watch-log`.

Installing on the watch (one-off):
1. On the watch: Settings → About watch → Software information → tap **Software version** seven times to turn on Developer options.
2. Settings → Developer options → turn on **ADB debugging** and **Wireless debugging** (watch and phone on the same Wi-Fi).
3. Install `mds-watch.apk` with a phone app such as Bugjaeger or Easy Fire Tools (pair using the code shown under Wireless debugging), or from a computer with `adb pair`, `adb connect` and `adb install mds-watch.apk`.
4. On the watch, long-press the watch face → Tiles → add **MDS Log**.
