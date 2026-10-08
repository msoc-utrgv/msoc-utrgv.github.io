#!/usr/bin/env python3
"""Local preview server for the Mathematical Society website.

    python3 server.py            # then open http://localhost:8000

It serves the site exactly as GitHub Pages would, and additionally provides the
small API that admin.html uses to save content and upload files:

    POST /api/login            {"username": "...", "password": "..."}
    POST /api/logout
    GET  /api/session          -> {"user": "..."} or 401
    GET  /api/content/<name>   -> the JSON in content/<name>.json
    PUT  /api/content/<name>   JSON body, written to content/<name>.json
    POST /api/upload?folder=<images|photos|resources>&filename=<name>
                               raw file body, written to media/<folder>/

PROTOTYPE ONLY. The login below is a plain placeholder so the editor can be
tried out on your own computer. This server only listens on 127.0.0.1 and must
not be exposed to the internet. The production login (hashed passwords, rate
limiting) lives in the Cloudflare Worker in worker/, which implements this same API.

Uses only the Python standard library.
"""

import argparse
import hashlib
import hmac
import json
import os
import re
import secrets
import time
from http import HTTPStatus
from http.cookies import SimpleCookie
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

ROOT = Path(__file__).resolve().parent

# Placeholder credentials for local use. Override with environment variables.
ADMIN_USER = os.environ.get("MSOC_ADMIN_USER", "admin")
ADMIN_PASSWORD = os.environ.get("MSOC_ADMIN_PASSWORD", "msoc-local-preview")

CONTENT_FILES = {"site", "home", "people", "events", "resources"}
UPLOAD_FOLDERS = {"images", "photos", "resources"}
UPLOAD_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif", ".pdf"}
MAX_CONTENT_BYTES = 1 * 1024 * 1024
MAX_UPLOAD_BYTES = 25 * 1024 * 1024

SESSION_COOKIE = "msoc_session"
SESSION_SECONDS = 8 * 60 * 60
MAX_FAILED_LOGINS = 5
LOCKOUT_SECONDS = 30

sessions = {}  # token -> (username, expiry timestamp)
failed_logins = {"count": 0, "locked_until": 0.0}


class ApiError(Exception):
    def __init__(self, status, message):
        super().__init__(message)
        self.status = status
        self.message = message


def safe_filename(name):
    """Reduce an uploaded file name to letters, digits, dots, dashes and underscores."""
    name = Path(name.replace("\\", "/")).name
    stem, ext = os.path.splitext(name)
    ext = ext.lower()
    if ext not in UPLOAD_EXTENSIONS:
        allowed = ", ".join(sorted(UPLOAD_EXTENSIONS))
        raise ApiError(HTTPStatus.BAD_REQUEST, f"That file type is not allowed. Allowed types: {allowed}")
    stem = re.sub(r"[^A-Za-z0-9_-]+", "-", stem).strip("-") or "file"
    return stem[:80], ext


def write_atomically(path, data):
    """Write to a temporary file first so a crash never leaves a half-written file."""
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.name}.{secrets.token_hex(4)}.tmp")
    temporary.write_bytes(data)
    temporary.replace(path)


class Handler(SimpleHTTPRequestHandler):
    server_version = "MSOCPreview/0.1"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    # ----- static files -------------------------------------------------

    def end_headers(self):
        # Always serve fresh files so edits show up on reload.
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self):
        path = urlsplit(self.path).path
        if path.startswith("/api/"):
            return self.handle_api("GET", path)
        hidden = any(part.startswith(".") for part in path.split("/"))
        if hidden or path.endswith((".py", ".pyc")):
            return self.send_error(HTTPStatus.NOT_FOUND)
        return super().do_GET()

    def do_POST(self):
        self.handle_api("POST", urlsplit(self.path).path)

    def do_PUT(self):
        self.handle_api("PUT", urlsplit(self.path).path)

    # ----- API plumbing -------------------------------------------------

    def handle_api(self, method, path):
        try:
            self.check_same_origin(method)
            result = self.route(method, path)
            self.send_json(HTTPStatus.OK, result if result is not None else {"ok": True})
        except ApiError as error:
            self.send_json(error.status, {"error": error.message})
        except Exception as error:  # keep the server alive, report the problem
            self.log_error("Unhandled error: %r", error)
            self.send_json(HTTPStatus.INTERNAL_SERVER_ERROR, {"error": "Unexpected server error."})

    def route(self, method, path):
        if (method, path) == ("POST", "/api/login"):
            return self.login()
        if (method, path) == ("POST", "/api/logout"):
            return self.logout()
        if (method, path) == ("GET", "/api/session"):
            return {"user": self.require_user()}
        if method == "GET" and path.startswith("/api/content/"):
            return self.load_content(path.removeprefix("/api/content/"))
        if method == "PUT" and path.startswith("/api/content/"):
            return self.save_content(path.removeprefix("/api/content/"))
        if (method, path) == ("POST", "/api/upload"):
            return self.upload()
        raise ApiError(HTTPStatus.NOT_FOUND, "Unknown API endpoint.")

    def check_same_origin(self, method):
        """Reject requests that change something unless they come from our own pages."""
        if method == "GET":
            return
        if self.headers.get("X-Requested-With") != "msoc-admin":
            raise ApiError(HTTPStatus.FORBIDDEN, "Missing X-Requested-With header.")
        origin = self.headers.get("Origin")
        if origin and urlsplit(origin).netloc != self.headers.get("Host"):
            raise ApiError(HTTPStatus.FORBIDDEN, "Cross-site requests are not allowed.")

    def read_body(self, limit):
        try:
            length = int(self.headers.get("Content-Length", ""))
        except ValueError:
            raise ApiError(HTTPStatus.LENGTH_REQUIRED, "Content-Length is required.") from None
        if length > limit:
            self.close_connection = True
            raise ApiError(HTTPStatus.REQUEST_ENTITY_TOO_LARGE, f"File is too large (limit {limit // (1024 * 1024)} MB).")
        return self.rfile.read(length)

    def read_json(self, limit=MAX_CONTENT_BYTES):
        try:
            return json.loads(self.read_body(limit).decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            raise ApiError(HTTPStatus.BAD_REQUEST, "Request body is not valid JSON.") from None

    def send_json(self, status, payload, cookie=None):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        if cookie or getattr(self, "pending_cookie", None):
            self.send_header("Set-Cookie", cookie or self.pending_cookie)
            self.pending_cookie = None
        self.end_headers()
        self.wfile.write(body)

    # ----- sessions -----------------------------------------------------

    def session_token(self):
        cookie = SimpleCookie(self.headers.get("Cookie", ""))
        return cookie[SESSION_COOKIE].value if SESSION_COOKIE in cookie else None

    def require_user(self):
        user, expires = sessions.get(self.session_token(), (None, 0))
        if not user or expires < time.time():
            raise ApiError(HTTPStatus.UNAUTHORIZED, "Please sign in.")
        return user

    def login(self):
        now = time.time()
        if failed_logins["locked_until"] > now:
            wait = int(failed_logins["locked_until"] - now) + 1
            raise ApiError(HTTPStatus.TOO_MANY_REQUESTS, f"Too many failed attempts. Try again in {wait} seconds.")

        body = self.read_json(limit=4096)
        username = str(body.get("username", "")) if isinstance(body, dict) else ""
        password = str(body.get("password", "")) if isinstance(body, dict) else ""
        # compare_digest avoids leaking how many characters matched.
        user_ok = hmac.compare_digest(username.encode(), ADMIN_USER.encode())
        password_ok = hmac.compare_digest(password.encode(), ADMIN_PASSWORD.encode())
        if not (user_ok and password_ok):
            failed_logins["count"] += 1
            if failed_logins["count"] >= MAX_FAILED_LOGINS:
                failed_logins.update(count=0, locked_until=now + LOCKOUT_SECONDS)
            raise ApiError(HTTPStatus.UNAUTHORIZED, "Incorrect username or password.")

        failed_logins.update(count=0, locked_until=0.0)
        token = secrets.token_urlsafe(32)
        sessions[token] = (username, now + SESSION_SECONDS)
        self.pending_cookie = (
            f"{SESSION_COOKIE}={token}; Path=/api; HttpOnly; SameSite=Strict; Max-Age={SESSION_SECONDS}"
        )
        return {"user": username}

    def logout(self):
        sessions.pop(self.session_token(), None)
        self.pending_cookie = f"{SESSION_COOKIE}=; Path=/api; HttpOnly; SameSite=Strict; Max-Age=0"
        return {"ok": True}

    # ----- content and uploads -----------------------------------------

    def load_content(self, name):
        self.require_user()
        if name not in CONTENT_FILES:
            raise ApiError(HTTPStatus.NOT_FOUND, f"Unknown content file: {name}")
        return json.loads((ROOT / "content" / f"{name}.json").read_text(encoding="utf-8"))

    def save_content(self, name):
        self.require_user()
        if name not in CONTENT_FILES:
            raise ApiError(HTTPStatus.NOT_FOUND, f"Unknown content file: {name}")
        data = self.read_json()
        if not isinstance(data, dict):
            raise ApiError(HTTPStatus.BAD_REQUEST, "Content must be a JSON object.")
        text = json.dumps(data, indent=2, ensure_ascii=False) + "\n"
        write_atomically(ROOT / "content" / f"{name}.json", text.encode("utf-8"))
        return {"ok": True}

    def upload(self):
        self.require_user()
        query = parse_qs(urlsplit(self.path).query)
        folder = query.get("folder", [""])[0]
        if folder not in UPLOAD_FOLDERS:
            raise ApiError(HTTPStatus.BAD_REQUEST, "Unknown upload folder.")
        stem, ext = safe_filename(query.get("filename", [""])[0])
        data = self.read_body(MAX_UPLOAD_BYTES)
        if not data:
            raise ApiError(HTTPStatus.BAD_REQUEST, "The uploaded file is empty.")

        directory = ROOT / "media" / folder
        target = directory / f"{stem}{ext}"
        # Never overwrite a different file that happens to share the name.
        if target.exists() and target.read_bytes() != data:
            target = directory / f"{stem}-{hashlib.sha256(data).hexdigest()[:8]}{ext}"
        if not target.exists():
            write_atomically(target, data)
        return {"path": target.relative_to(ROOT).as_posix()}


def main():
    parser = argparse.ArgumentParser(description="Local preview server for the MSOC website.")
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()

    server = ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
    print(f"Website:  http://localhost:{args.port}/")
    print(f"Editor:   http://localhost:{args.port}/admin.html")
    print(f"Sign in:  {ADMIN_USER} / {ADMIN_PASSWORD}   (local placeholder login)")
    print("Press Ctrl+C to stop.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")


if __name__ == "__main__":
    main()
