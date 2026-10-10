#!/usr/bin/env python3
"""Live Fly domain proof on the isolated smoke app; --prepare seeds a test site."""

import argparse
import json
import sys
import urllib.error
import urllib.parse
from pathlib import Path

sys.dont_write_bytecode = True
from verify import Client, GROUP, HTML, MARKER, require

SITE = "flydomainsite01"
PAGE_TYPE = "flydomaintype01"
PAGE = "flydomainpage01"
UPLOAD = "flydomainupld01"
HOST = "fly-domain-test.primo.page"
BASE = "https://fly-smoke.primo.page"
ENDPOINT = "/api/primo/sites/" + SITE + "/domain"


def expect_error(client, method, path, status, data=None):
    try:
        client.request(method, path, data)
    except urllib.error.HTTPError as error:
        require(error.code == status, "Unexpected status for access/validation check: " + str(error.code))
    else:
        raise RuntimeError("Access/validation check unexpectedly succeeded.")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--credentials", required=True, type=Path)
    parser.add_argument("--prepare", action="store_true")
    parser.add_argument("--require-live", action="store_true")
    parser.add_argument("--records-output", type=Path)
    args = parser.parse_args()
    require(args.credentials.stat().st_mode & 0o077 == 0, "Credentials file must be private (mode 600).")
    credentials = dict(line.split("=", 1) for line in args.credentials.read_text().splitlines() if line and not line.startswith("#"))
    customer = Client(BASE)
    info = customer.request("GET", "/api/primo/info", authenticated=False)
    require(info["domain_provider"] == "fly", "Fly provider is not enabled.")
    customer.login("users", credentials["PRIMO_USER_EMAIL"], credentials["PRIMO_USER_PASSWORD"])

    if args.prepare:
        customer.ensure_record("sites", SITE, {"name": "Fly domain test", "host": "domain-test.fly-smoke.primo.page", "group": GROUP})
        customer.ensure_record("page_types", PAGE_TYPE, {"name": "Domain test page", "site": SITE})
        customer.ensure_record("pages", PAGE, {"name": "Home", "site": SITE, "page_type": PAGE_TYPE, "slug": ""},
                               [("compiled_html", "index.html", "text/html", HTML)])
        customer.ensure_record("site_uploads", UPLOAD, {"site": SITE},
                               [("file", "domain-test.txt", "text/plain", MARKER)])
        customer.request("POST", "/api/primo/generate", {"site_id": SITE})
        expect_error(Client(BASE), "POST", ENDPOINT, 401, {"host": HOST})
        expect_error(Client(BASE), "GET", ENDPOINT + "/status", 401)
        expect_error(customer, "POST", ENDPOINT, 400, {"host": "https://invalid.example.com/path"})
        result = customer.request("POST", ENDPOINT, {"host": HOST})
        require(result["host"] == HOST and result["status"] in {"pending", "verifying", "live"}, "Domain attach failed.")
        require(len(result["records"]) == 3, "Expected routing, ACME, and ownership records.")
        repeat = customer.request("POST", ENDPOINT, {"host": HOST})
        require(repeat["host"] == HOST, "Existing domain could not be adopted on retry.")
        expect_error(customer, "POST", ENDPOINT + "/mark-live", 400)
        print("PASS: authenticated customer attach, duplicate adoption, validation, and access controls")

    result = customer.request("GET", ENDPOINT + "/status")
    site = customer.record("sites", SITE)
    require(site["host"] == HOST and site["domain_provider_id"] == HOST and site["domain_status"] == result["status"],
            "Domain state was not persisted correctly.")
    require(customer.request("GET", "/?_site=" + SITE, authenticated=False) == HTML, "Published preview missing after attach.")
    print("PASS: persisted domain state and published content after host change")
    if args.records_output:
        args.records_output.write_text(json.dumps(result, indent=2) + "\n")
    print("Domain status: " + result["status"])
    print(json.dumps(result["records"], indent=2))

    if args.require_live:
        require(result["status"] == "live", "Domain is still awaiting DNS or its certificate.")
        require(all(record["status"] == "valid" for record in result["records"]), "Some DNS records have not validated.")
        public = Client("https://" + HOST)
        require(public.request("GET", "/", authenticated=False) == HTML, "Custom-domain HTTPS page failed.")
        upload = customer.record("site_uploads", UPLOAD)
        filename = urllib.parse.quote(upload["file"])
        require(public.request("GET", "/_uploads/" + filename, authenticated=False) == MARKER, "Custom-domain HTTPS upload failed.")
        require(customer.request("GET", "/api/files/site_uploads/" + UPLOAD + "/" + filename) == MARKER,
                "Original upload bytes changed.")
        print("PASS: issued certificate, custom-domain HTTPS page, and original/published uploads")


if __name__ == "__main__":
    try:
        main()
    except urllib.error.HTTPError as error:
        try:
            detail = json.loads(error.read())
            message = detail.get("message", "Request failed")
            fields = ", ".join(detail.get("data", {}).keys())
        except (ValueError, AttributeError):
            message, fields = "Request failed", ""
        sys.exit("FAIL: HTTP " + str(error.code) + ": " + message + (" (fields: " + fields + ")" if fields else ""))
    except Exception as error:
        sys.exit("FAIL: " + str(error))
