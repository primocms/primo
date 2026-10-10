#!/usr/bin/env python3
"""Verify the guarded customer image on disposable private resources in the smoke app.

No public services, DNS changes, purchases or email. Only resources created by
this run are removed. Requires the previously approved smoke-app token file.
"""
import argparse
import json
import os
from pathlib import Path
import secrets
import subprocess
import tempfile
import time
import urllib.error
import urllib.request

APP = "primo-hosted-smoke"
API = "https://api.machines.dev/v1/apps/" + APP
IMAGE = "registry.fly.io/primo-hosted-smoke@sha256:c69e8f8cfe181cace0da7d87c829bc4773800d40280445a7eb4785e2381031c9"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--token-file", type=Path, required=True)
    args = parser.parse_args()
    if args.token_file.stat().st_mode & 0o077:
        raise RuntimeError("Token file must be private (mode 600).")
    values = dict(line.split("=", 1) for line in args.token_file.read_text().splitlines() if "=" in line)
    token = values["PRIMO_FLY_TOKEN"]

    def request(method, path, body=None):
        data = None if body is None else json.dumps(body).encode()
        req = urllib.request.Request(API + path, data=data, method=method,
                                     headers={"Authorization": "Bearer " + token, "Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=30) as response:
                raw = response.read()
                return json.loads(raw) if raw else None
        except urllib.error.HTTPError as error:
            raise RuntimeError("Fly API returned HTTP " + str(error.code)) from None

    def run(machine, command, stdin=""):
        return request("POST", "/machines/" + machine + "/exec", {"cmd": command, "stdin": stdin, "timeout": 10})

    def info(machine):
        for attempt in range(20):
            try:
                result = run(machine, "wget -q -O - http://127.0.0.1:8080/api/primo/info")
                if result.get("exit_code", 0) == 0:
                    return json.loads(result["stdout"])
            except (RuntimeError, ValueError, KeyError):
                pass
            time.sleep(2)
        raise RuntimeError("Private customer bootstrap did not become healthy.")

    def login(machine, collection, email, password):
        # Send normal HTTP JSON through a loopback-only WireGuard proxy. No
        # password appears in an exec command, process argument or test output.
        body = json.dumps({"identity": email, "password": password}).encode()
        req = urllib.request.Request("http://127.0.0.1:18082/api/collections/" + collection + "/auth-with-password",
                                     data=body, headers={"Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=10) as response:
                return json.load(response)["record"]
        except urllib.error.HTTPError as error:
            raise RuntimeError("Bootstrap sign-in returned HTTP " + str(error.code)) from None

    volume = machine = proxy = None
    proxy_log = tempfile.TemporaryFile()
    password, admin_password = secrets.token_urlsafe(32), secrets.token_urlsafe(32)
    suffix = secrets.token_hex(4)
    try:
        result = request("POST", "/volumes", {"name": "bootstrap_verify", "region": "iad", "size_gb": 1,
                                               "encrypted": True, "auto_backup_enabled": True, "snapshot_retention": 7})
        volume = result["id"]
        config = {"image": IMAGE, "env": {
            "PRIMO_HOSTED_MODE": "true", "PRIMO_MANAGED_BOOTSTRAP": "true", "PRIMO_SITE_CAP": "7", "PRIMO_EDITOR_CAP": "2",
            "PRIMO_DOMAIN_PROVIDER": "fly", "PRIMO_APP_URL": "https://fly-smoke.primo.page", "PRIMO_BASE_DOMAIN": "fly-smoke.primo.page",
            "PRIMO_SUPERUSER_EMAIL": "bootstrap-operator@primo.page", "PRIMO_SUPERUSER_PASSWORD": admin_password,
            "PRIMO_USER_EMAIL": "bootstrap-customer@primo.page", "PRIMO_USER_PASSWORD": password},
            "mounts": [{"volume": volume, "path": "/app/pb_data"}], "services": [],
            "guest": {"cpu_kind": "shared", "cpus": 1, "memory_mb": 512}, "restart": {"policy": "always"}}
        result = request("POST", "/machines", {"name": "primo-bootstrap-verify-" + suffix, "region": "iad", "config": config})
        machine = result["id"]
        settings = info(machine)
        assert settings["managed_bootstrap"] and settings["hosted_mode"]
        assert settings["site_cap"] == 7 and settings["editor_cap"] == 2 and settings["domain_provider"] == "fly"
        assert settings["version"] == "3.3.0-fly-smoke.3"
        fly_dir = args.token_file.parent
        proxy_env = dict(os.environ, FLY_CONFIG_DIR=str(fly_dir / "config"))
        proxy = subprocess.Popen([str(fly_dir / "bin/flyctl"), "proxy", "18082:8080", result["private_ip"],
                                  "--app", APP, "--bind-addr", "127.0.0.1"], env=proxy_env,
                                 stdout=proxy_log, stderr=proxy_log)
        for attempt in range(20):
            try:
                with urllib.request.urlopen("http://127.0.0.1:18082/api/health", timeout=2) as response:
                    if response.status == 200:
                        break
            except (urllib.error.URLError, OSError):
                time.sleep(2)
        user = login(machine, "users", "bootstrap-customer@primo.page", password)
        assert user["serverRole"] == "developer"
        login(machine, "_superusers", "bootstrap-operator@primo.page", admin_password)
        print("PASS: clean private first boot, managed guard, Solo caps and both bootstrap accounts")
        request("POST", "/machines/" + machine + "/stop", {"signal": "SIGTERM", "timeout": "30s"})
        for attempt in range(20):
            if request("GET", "/machines/" + machine)["state"] == "stopped":
                break
            time.sleep(2)
        request("POST", "/machines/" + machine + "/start", {})
        assert info(machine)["managed_bootstrap"]
        login(machine, "users", "bootstrap-customer@primo.page", password)
        print("PASS: customer sign-in and guarded startup persist after restart")
    finally:
        if proxy:
            proxy.terminate()
            try:
                proxy.wait(timeout=5)
            except subprocess.TimeoutExpired:
                proxy.kill()
                proxy.wait(timeout=5)
        proxy_log.close()
        if machine:
            request("DELETE", "/machines/" + machine + "?force=true")
            print("Removed this run's private test Machine.")
        if volume:
            request("DELETE", "/volumes/" + volume)
            print("Removed this run's test volume; original smoke server and volume untouched.")


if __name__ == "__main__":
    main()
