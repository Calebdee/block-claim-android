"""Block Claim game server.

A tiny turn-based relay: each online game is one row holding the whole game state
(a JSON string the client builds), a revision number, and a private token per seat.
Up to four seats: the host is seat 1 (Blue); joiners take 2 (Red), 3 (Yellow), 4 (Green)
while the game is waiting, then the host starts it.

  POST /api/games                 create a game (waiting)     -> {code, seat: 1, token, rev}
  POST /api/games/<code>/join     take the next seat / rejoin -> {seat, token}   (seat 0 = watching)
  GET  /api/games/<code>?since=N  latest state if rev > N, else 204
  POST /api/games/<code>/move     save a move or start        -> {rev}   (409 if out of date)
  GET  /                          the game page itself
"""
import json
import os
import secrets
import sqlite3
import time

from flask import Flask, g, jsonify, request, send_from_directory

DATA_DIR = os.environ.get("DATA_DIR", os.path.join(os.path.dirname(__file__), "data"))
os.makedirs(DATA_DIR, exist_ok=True)
DB_PATH = os.path.join(DATA_DIR, "games.db")
STATIC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")
CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
MAX_STATE_BYTES = 400_000
MAX_SEATS = 4
SEAT_COLORS = ["Blue", "Red", "Yellow", "Green"]
KEEP_DAYS = float(os.environ.get("KEEP_DAYS", "30"))
STATUSES = ("waiting", "playing", "over")

app = Flask(__name__, static_folder=None)


def init_db():
    con = sqlite3.connect(DB_PATH)
    con.execute("PRAGMA journal_mode=WAL")
    con.execute(
        """CREATE TABLE IF NOT EXISTS games (
            code    TEXT PRIMARY KEY,
            state   TEXT NOT NULL,
            rev     INTEGER NOT NULL,
            status  TEXT NOT NULL,
            token1  TEXT,
            token2  TEXT,
            created REAL NOT NULL,
            updated REAL NOT NULL
        )"""
    )
    cols = {r[1] for r in con.execute("PRAGMA table_info(games)")}
    if "tokens" not in cols:  # added for 3-4 player games
        con.execute("ALTER TABLE games ADD COLUMN tokens TEXT")
    con.commit()
    con.close()


init_db()


def db():
    if "db" not in g:
        con = sqlite3.connect(DB_PATH, timeout=10, isolation_level=None)  # we manage transactions
        con.row_factory = sqlite3.Row
        g.db = con
    return g.db


@app.teardown_appcontext
def close_db(_exc):
    con = g.pop("db", None)
    if con is not None:
        con.close()


@app.after_request
def add_headers(resp):
    # The Android app loads the game from a local file, so it calls us cross-origin.
    resp.headers["Access-Control-Allow-Origin"] = "*"
    resp.headers["Access-Control-Allow-Headers"] = "Content-Type, X-Seat-Token"
    resp.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    resp.headers["Cache-Control"] = "no-store"
    return resp


@app.route("/api/<path:_p>", methods=["OPTIONS"])
def preflight(_p):
    return "", 204


def error(msg, status=400, **extra):
    return jsonify(error=msg, **extra), status


def body():
    data = request.get_json(silent=True)
    return data if isinstance(data, dict) else {}


def clean_code(code):
    code = (code or "").upper()
    return code if len(code) == 4 and all(c in CODE_CHARS for c in code) else None


def valid_state(state):
    if not isinstance(state, str) or len(state.encode()) > MAX_STATE_BYTES:
        return None
    try:
        parsed = json.loads(state)
    except ValueError:
        return None
    return parsed if isinstance(parsed, dict) else None


def tokens_of(row):
    """Seat tokens in seat order (older rows kept them in token1/token2)."""
    if row["tokens"]:
        return json.loads(row["tokens"])
    return [t for t in (row["token1"], row["token2"]) if t]


def seat_for(row, token):
    if not token:
        return 0
    for i, t in enumerate(tokens_of(row)):
        if t and secrets.compare_digest(str(token), t):
            return i + 1
    return 0


def view(row, seat):
    toks = tokens_of(row)
    return {
        "code": row["code"],
        "rev": row["rev"],
        "status": row["status"],
        "state": row["state"],
        "seat": seat,
        "seats": {str(i + 1): bool(i < len(toks)) for i in range(MAX_SEATS)},
    }


@app.get("/")
def index():
    return send_from_directory(STATIC_DIR, "index.html")


@app.get("/api/health")
def health():
    return jsonify(ok=True, app="block-claim")


@app.post("/api/games")
def create_game():
    state = body().get("state")
    if valid_state(state) is None:
        return error("The game state is missing or too large.")
    con = db()
    now = time.time()
    con.execute("DELETE FROM games WHERE updated < ?", (now - KEEP_DAYS * 86400,))
    token = secrets.token_urlsafe(18)
    for _ in range(40):
        code = "".join(secrets.choice(CODE_CHARS) for _ in range(4))
        try:
            con.execute(
                "INSERT INTO games (code, state, rev, status, token1, token2, tokens, created, updated)"
                " VALUES (?, ?, 1, 'waiting', ?, NULL, ?, ?, ?)",
                (code, state, token, json.dumps([token]), now, now),
            )
            return jsonify(code=code, seat=1, token=token, rev=1), 201
        except sqlite3.IntegrityError:
            continue
    return error("Couldn't find a free game code. Try again.", 503)


@app.post("/api/games/<code>/join")
def join_game(code):
    code = clean_code(code)
    if not code:
        return error("Game codes are 4 characters, like K7QM.")
    data = body()
    con = db()
    con.execute("BEGIN IMMEDIATE")
    try:
        row = con.execute("SELECT * FROM games WHERE code = ?", (code,)).fetchone()
        if row is None:
            con.execute("ROLLBACK")
            return error(f"No game found with code {code}.", 404)
        seat = seat_for(row, data.get("token"))
        if seat:  # rejoining with a saved token
            con.execute("COMMIT")
            return jsonify(seat=seat, token=data.get("token"))
        toks = tokens_of(row)
        if row["status"] != "waiting" or len(toks) >= MAX_SEATS:  # started or full: watch only
            con.execute("COMMIT")
            return jsonify(seat=0, token=None)
        seat = len(toks) + 1
        name = str(data.get("name") or "").strip()[:18] or f"Player {seat}"
        state = json.loads(row["state"])
        settings = state.setdefault("S", {})
        players = settings.setdefault("players", [{"n": settings.get("n1", "Player 1")}])
        del players[seat - 1:]
        players.append({"n": name})
        state["note"] = f"{name} joined as {SEAT_COLORS[seat - 1]}."
        token = secrets.token_urlsafe(18)
        toks.append(token)
        con.execute(
            "UPDATE games SET state = ?, tokens = ?, rev = rev + 1, updated = ? WHERE code = ?",
            (json.dumps(state, separators=(",", ":")), json.dumps(toks), time.time(), code),
        )
        con.execute("COMMIT")
        return jsonify(seat=seat, token=token)
    except Exception:
        con.execute("ROLLBACK")
        raise


@app.get("/api/games/<code>")
def get_game(code):
    code = clean_code(code)
    if not code:
        return error("Game codes are 4 characters, like K7QM.")
    try:
        since = int(request.args.get("since", "-1"))
    except ValueError:
        since = -1
    row = db().execute("SELECT * FROM games WHERE code = ?", (code,)).fetchone()
    if row is None:
        return error(f"No game found with code {code}.", 404)
    if row["rev"] <= since:
        return "", 204
    return jsonify(view(row, seat_for(row, request.headers.get("X-Seat-Token"))))


@app.post("/api/games/<code>/move")
def move(code):
    code = clean_code(code)
    if not code:
        return error("Game codes are 4 characters, like K7QM.")
    data = body()
    state = data.get("state")
    new_state = valid_state(state)
    status = data.get("status")
    try:
        base = int(data.get("base"))
    except (TypeError, ValueError):
        return error("Missing the revision this move was based on.")
    if new_state is None or status not in STATUSES:
        return error("The move is missing its game state.")
    con = db()
    con.execute("BEGIN IMMEDIATE")
    try:
        row = con.execute("SELECT * FROM games WHERE code = ?", (code,)).fetchone()
        if row is None:
            con.execute("ROLLBACK")
            return error(f"No game found with code {code}.", 404)
        seat = seat_for(row, data.get("token"))
        if not seat:
            con.execute("ROLLBACK")
            return error("Only players in this game can make moves.", 403)
        if row["rev"] != base:
            con.execute("ROLLBACK")
            return error("The game moved on. Reloading the latest board.", 409, game=view(row, seat))
        if row["status"] == "waiting":
            # Only the host can act in the lobby: start the game (or call it off).
            if seat != 1 or status == "waiting":
                con.execute("ROLLBACK")
                return error("Waiting for the host to start the game.", 409, game=view(row, seat))
            if status == "playing" and len(tokens_of(row)) < 2:
                con.execute("ROLLBACK")
                return error("Waiting for at least one more player to join.", 409, game=view(row, seat))
        current = json.loads(row["state"])
        # During play only the player whose turn it is may move; either player may end the game
        # early, and either may start a rematch once it is over.
        if row["status"] == "playing" and current.get("turn") != seat and status != "over":
            con.execute("ROLLBACK")
            return error("It's not your turn.", 403)
        con.execute(
            "UPDATE games SET state = ?, rev = ?, status = ?, updated = ? WHERE code = ?",
            (state, base + 1, status, time.time(), code),
        )
        con.execute("COMMIT")
        return jsonify(rev=base + 1)
    except Exception:
        con.execute("ROLLBACK")
        raise


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", "8787")))
