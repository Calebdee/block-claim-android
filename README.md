# Block Claim

A dice-and-blocks territory game for 2 to 4 players (Blue, Red, Yellow, Green), with
computer opponents: an offline Android app, plus a small game server you can run on your
own NAS for online play.

## Android app

Every push to `main` builds the APK on GitHub. Download the newest one on your phone:

`https://github.com/Calebdee/block-claim-android/releases/latest/download/block-claim.apk`

The first time, Android asks you to allow installs from your browser; allow it, then install.
New builds install over the old one and keep your saved game.

## Game server (Docker, e.g. on a Synology NAS)

The server stores online games and also serves the game page, so any phone or laptop can
play in a browser without installing anything.

### Start it

From a terminal on the NAS (SSH, or code-server if it can run `docker`):

```sh
git clone https://github.com/Calebdee/block-claim-android.git
cd block-claim-android
sudo docker compose up -d --build      # older DSM: sudo docker-compose up -d --build
```

Or in **Container Manager → Project → Create**: pick the cloned `block-claim-android`
folder as the path. It finds `docker-compose.yml`; then choose **Build** and start it.

Check it's running: open `http://<NAS-IP>:8787/api/health` — you should see `"ok":true`.

### Play online

- **In a browser:** open `http://<NAS-IP>:8787` on each phone. Host on one; up to three others Join with the code (Red, then Yellow, then Green), and the host taps Start.
- **In the Android app:** pick Host online or Join online, enter `<NAS-IP>:8787` as the game server, and tap Test connection.

Both phones must be able to reach the NAS: on the same Wi-Fi, or anywhere through
Tailscale (install the Tailscale package on the NAS and the app on each phone, then use the
NAS's Tailscale address).

If the connection test fails on your home network, check **Control Panel → Security →
Firewall** on the NAS allows port 8787.

### Update it

```sh
cd block-claim-android
git pull
sudo docker compose up -d --build
```

Saved games live in `block-claim-android/data/games.db` and survive updates and restarts.
Games untouched for 30 days are deleted (change `KEEP_DAYS` in `docker-compose.yml`).

### How it works

Each game is one row: the whole game state as JSON, a revision number, and a private token
for each of up to four seats. Phones check for a newer revision every 1.5 seconds. The server only accepts
a move from the player whose turn it is, based on the latest revision, so moves can't
cross or be forged by someone who only knows the code.

| Endpoint | Purpose |
|---|---|
| `POST /api/games` | create a game, get the code and seat 1's token |
| `POST /api/games/<code>/join` | take the next seat while the lobby is open (or rejoin with your token) |
| `GET /api/games/<code>?since=<rev>` | latest state if newer, else `204` |
| `POST /api/games/<code>/move` | save a move, or the host starts the game (`409` if the game moved on) |

## Editing the game

The game lives in `game/block-claim.html`. After changing it:

```sh
python3 tools/wrap_game.py   # refreshes app/src/main/assets/index.html
```

Push to `main` and GitHub rebuilds the APK and re-checks the server image. Run
`git pull && sudo docker compose up -d --build` on the NAS to update the browser version.

## Signing

`app/blockclaim.keystore` is a fixed signing key kept in the repo so every build can update
the last one. Fine for a personal sideloaded app; make a new private key if you ever publish
to the Play Store.

## Computer players

`tools/ai-bench/sim.js` plays computer levels against each other headlessly, rotating seats:

```sh
node tools/ai-bench/sim.js 40 25 25 hard,medium
node tools/ai-bench/sim.js 24 25 25 hard,medium,medium,medium
node tools/ai-bench/sim.js 30 25 25 hard,medium open rooms   # specialty boards: rooms, choke, rocks
```
