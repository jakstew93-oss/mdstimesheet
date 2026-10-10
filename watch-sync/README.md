# MDS watch sync test version

This branch adds a standalone Wear OS watch app, an opt-in phone connector and a Cloudflare Worker/D1 sync service. It does **not** change the live GitHub Pages app until merged. No live service URL or Cloudflare credentials are configured in this repository.

## Activate the sync service

On a computer with Node installed, in `watch-sync/service/`:

1. `npm install`
2. `npx wrangler login`
3. `npx wrangler d1 create mds-watch-sync`
4. Put the returned `database_id` in `wrangler.toml`.
5. `npx wrangler d1 execute mds-watch-sync --remote --file schema.sql`
6. `npx wrangler deploy`

Use the HTTPS Worker address returned by deployment. The API accepts browser requests only from the existing GitHub Pages origin. Native watch requests use bearer credentials. Existing local employee passwords are not sent to or used by this service.

## Phone and watch

After reviewing/merging this branch, sign in to the intended employee on the phone, open **Connect watch**, enter the service address and get a code. Install the `mds-watch-test-apk` from the branch's GitHub Actions build on the watch. In **Pair with phone**, enter the same address and eight-digit code. Codes are one use, expire after five minutes and permit five redemption attempts per IP per five minutes. Anyone holding the code can connect to that employee's sync dataset during its validity.

Choose a job, then tap Start → On site → Off site → Finish. The next tap after Finish starts a new shift using the same job. Changing job starts a new entry and retains previous logs. Today's entries shows phone/watch entries; tap an entry to resume it. An active overnight shift keeps its original date. Each tap retains epoch milliseconds and its UTC offset as well as displayed HH:mm.

Existing phone entries are assigned stable sync IDs and uploaded only after the service is configured. Other accounts and vehicle/expense/holiday forms are not uploaded. The same employee on another phone needs the **same connection token**, not an independently generated code/token; this initial UI pairs one existing phone with a watch.

## Durability and conflicts

Watch taps are written through Android AtomicFile before confirmation. Phone pending operations, acknowledgements and cursors are stored in localStorage. Server operations are durably inserted in D1 with unique session/operation IDs. Retries cannot duplicate a row. Pulls overlay unacknowledged edits made while requests are in flight. Phone totals and break deductions use the app's existing calculations.

Each row field uses the latest operation received by the server. Concurrent changes to the same field therefore use server arrival order; other fields merge. Deletion is permanent for that sync ID so delayed offline taps cannot resurrect a deleted row. Phone undo creates a fresh sync ID when restoring a deleted row. A deleted active watch entry starts a fresh row on the next tap.

Sync runs every 15 seconds while either app is open, when the phone regains connection, and on app reopening. **There is no guaranteed background sync while apps are closed.** Pending records survive app restarts; leave the app installed until they have synced. Manual sync is available. Do not clear app data or switch employee connections while pending logs are needed.

Disconnecting the phone stops that phone's sync; it does not revoke the watch token or erase server records. Treat pairing tokens as credentials. Production credential rotation, device revocation, account recovery and retention policy are outside this first test version and must be addressed before broad rollout.

## Validation

`node --test tools/test-watch-sync.cjs` runs real SQLite-backed tests of account isolation, duplicate prevention, pairing, pagination, offline queues, deletion and account changes during requests. Existing timesheet tests must also pass. `gradle testDebugUnitTest assembleDebug` in `watch-app/` builds the native app and runs watch state tests. GitHub Actions produces the watch APK and bundles the Worker without deployment.

Physical Galaxy Watch8 Classic layout, keyboard entry, rotary input, vibration, installation, networking and real phone/watch end-to-end sync still need device testing. This is a test APK, not a Play Store release.
