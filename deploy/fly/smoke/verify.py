#!/usr/bin/env python3
"""Verify the isolated Fly smoke server; --seed creates synthetic test content."""

import argparse
import json
import secrets
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

SITE = "flysmokesite001"
GROUP = "flysmokegroup01"
PAGE_TYPE = "flysmoketype001"
PAGE = "flysmokepage001"
UPLOAD = "flysmokeupld001"
MARKER = b"Primo Fly persistence smoke test\n"
HTML = b"<!doctype html><html><head><title>Primo Fly test</title></head><body><h1>Primo Fly test</h1><p>Published content and uploads survive a server restart.</p></body></html>"


class Client:
    def __init__(self, base):
        self.base = base.rstrip("/")
        self.token = ""

    def request(self, method, path, data=None, content_type=None, authenticated=True):
        headers = {}
        if authenticated and self.token:
            headers["Authorization"] = self.token
        if data is not None and not isinstance(data, bytes):
            data = json.dumps(data).encode()
            content_type = "application/json"
        if content_type:
            headers["Content-Type"] = content_type
        request = urllib.request.Request(self.base + path, data=data, headers=headers, method=method)
        with urllib.request.urlopen(request, timeout=30) as response:
            raw = response.read()
            if response.headers.get("Content-Type", "").startswith("application/json"):
                return json.loads(raw)
            return raw

    def login(self, collection, email, password):
        result = self.request("POST", "/api/collections/" + collection + "/auth-with-password",
                              {"identity": email, "password": password}, authenticated=False)
        self.token = result["token"]
        return result["record"]

    def record(self, collection, record_id):
        return self.request("GET", "/api/collections/" + collection + "/records/" + record_id)

    def ensure_record(self, collection, record_id, values, files=None):
        try:
            return self.record(collection, record_id)
        except urllib.error.HTTPError as error:
            if error.code != 404:
                raise
        values = dict(values, id=record_id)
        path = "/api/collections/" + collection + "/records"
        if not files:
            return self.request("POST", path, values)
        boundary = "primo-smoke-" + secrets.token_hex(16)
        parts = []
        for key, value in values.items():
            parts.append(("--" + boundary + '\r\nContent-Disposition: form-data; name="' + key + '"\r\n\r\n' + str(value) + "\r\n").encode())
        for key, filename, mime, content in files:
            parts.append(("--" + boundary + '\r\nContent-Disposition: form-data; name="' + key + '"; filename="' + filename + '"\r\nContent-Type: ' + mime + "\r\n\r\n").encode() + content + b"\r\n")
        parts.append(("--" + boundary + "--\r\n").encode())
        return self.request("POST", path, b"".join(parts), "multipart/form-data; boundary=" + boundary)


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default="https://primo-hosted-smoke.fly.dev")
    parser.add_argument("--credentials", required=True, type=Path)
    parser.add_argument("--seed", action="store_true")
    parser.add_argument("--restore-proxy", action="store_true",
                        help="Check a private restore Machine through a localhost-only Fly tunnel.")
    args = parser.parse_args()
    url = urllib.parse.urlsplit(args.url)
    allowed = (url.scheme == "https" and url.netloc in {"primo-hosted-smoke.fly.dev", "fly-smoke.primo.page"})
    if args.restore_proxy:
        allowed = url.scheme == "http" and url.netloc == "127.0.0.1:18080"
        require(not args.seed, "A restore check must verify existing data, never seed it.")
    require(allowed and url.path in {"", "/"} and not url.query and not url.fragment,
            "Only the isolated HTTPS smoke server or explicit localhost restore tunnel is allowed.")
    require(args.credentials.stat().st_mode & 0o077 == 0, "Credentials file must be private (mode 600).")
    credentials = dict(line.split("=", 1) for line in args.credentials.read_text().splitlines() if line and not line.startswith("#"))
    client = Client(args.url)
    require(client.request("GET", "/api/health")["code"] == 200, "Health check failed.")
    info = client.request("GET", "/api/primo/info")
    require(info["hosted_mode"] is True and info["site_cap"] == 3, "Hosted mode or Maker site cap missing.")
    print("PASS: " + ("private restore health" if args.restore_proxy else "HTTPS health") + ", hosted mode, and Maker site cap")

    user = client.login("users", credentials["PRIMO_USER_EMAIL"], credentials["PRIMO_USER_PASSWORD"])
    # The users collection intentionally hides its verified field from API output.
    require(user["serverRole"] == "developer", "Customer account incorrectly initialized.")
    print("PASS: initialized customer can sign in")
    client.login("_superusers", credentials["PRIMO_SUPERUSER_EMAIL"], credentials["PRIMO_SUPERUSER_PASSWORD"])
    try:
        client.request("POST", "/api/collections/_superusers/auth-with-password",
                       {"identity": "__pbinstaller@example.com", "password": "public-secret"}, authenticated=False)
    except urllib.error.HTTPError as error:
        require(error.code in {400, 401, 403}, "Unexpected installer-account response.")
    else:
        raise RuntimeError("Public installer account must be inaccessible after initialization.")
    print("PASS: public first-run account is unavailable")

    if args.seed:
        client.ensure_record("site_groups", GROUP, {"name": "Fly smoke tests"})
        client.ensure_record("sites", SITE, {"name": "Fly smoke test", "host": "site.fly-smoke.primo.page", "group": GROUP})
        client.ensure_record("page_types", PAGE_TYPE, {"name": "Fly smoke page", "site": SITE})
        client.ensure_record("pages", PAGE, {"name": "Home", "site": SITE, "page_type": PAGE_TYPE, "slug": ""},
                             [("compiled_html", "index.html", "text/html", HTML)])
        client.ensure_record("site_uploads", UPLOAD, {"site": SITE},
                             [("file", "fly-smoke.txt", "text/plain", MARKER)])
        client.request("POST", "/api/primo/generate", {"site_id": SITE})
        print("Created synthetic site, published page, and uploaded file.")

    require(client.record("sites", SITE)["name"] == "Fly smoke test", "Test site missing.")
    require(client.record("pages", PAGE)["name"] == "Home", "Test page missing.")
    upload = client.record("site_uploads", UPLOAD)
    filename = urllib.parse.quote(upload["file"])
    require(client.request("GET", "/api/files/site_uploads/" + UPLOAD + "/" + filename) == MARKER, "Uploaded file changed.")
    require(client.request("GET", "/?_site=" + SITE, authenticated=False) == HTML, "Published page changed.")
    require(client.request("GET", "/_uploads/" + filename + "?_site=" + SITE, authenticated=False) == MARKER,
            "Published upload changed.")
    print("PASS: database records, uploaded bytes, published page, and published upload")
    if url.netloc == "fly-smoke.primo.page":
        require(info.get("base_domain") == "fly-smoke.primo.page", "Workspace base domain missing.")
        site_client = Client("https://site.fly-smoke.primo.page")
        require(site_client.request("GET", "/", authenticated=False) == HTML, "Wildcard site routing failed.")
        require(site_client.request("GET", "/_uploads/" + filename, authenticated=False) == MARKER,
                "Wildcard upload routing failed.")
        print("PASS: wildcard HTTPS site and upload routing")


if __name__ == "__main__":
    try:
        main()
    except urllib.error.HTTPError as error:
        # Report only provider validation messages, never credentials or tokens.
        try:
            detail = json.loads(error.read())
            message = detail.get("message", "Request failed")
            fields = ", ".join(detail.get("data", {}).keys())
        except (ValueError, AttributeError):
            message, fields = "Request failed", ""
        sys.exit("FAIL: HTTP " + str(error.code) + ": " + message + (" (fields: " + fields + ")" if fields else ""))
    except Exception as error:
        sys.exit("FAIL: " + str(error))
