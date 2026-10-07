# Block Claim for Android

A two-player dice-and-blocks territory game, packaged as an offline Android app.

## Get the app

Every push to `main` builds the APK on GitHub. Download the newest one on your phone:

`https://github.com/<owner>/<repo>/releases/latest/download/block-claim.apk`

Or open the repo's **Releases** page and tap `block-claim.apk`. The first time, Android asks you to allow installs from your browser; allow it, then install. New builds install over the old one and keep your saved game.

## What's inside

- `app/src/main/assets/index.html` — the whole game, bundled so it runs with no connection.
- `MainActivity.java` — a full-screen WebView that loads the game.
- `.github/workflows/build-apk.yml` — builds and signs the APK, then publishes it as a release.

The app plays on one phone. Online Host/Join needs the Claude-hosted version of the page.

## Updating the game

Replace `app/src/main/assets/index.html` with a new version and push. A new release appears a few minutes later.

## Signing

`app/blockclaim.keystore` is a fixed signing key kept in the repo so every build can update the last one. That's fine for a personal sideloaded app. If you ever publish to the Play Store, make a new private key and keep it out of the repo.
