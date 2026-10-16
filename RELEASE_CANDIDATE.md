# CMS v3.3.2-rc.2 — draft release candidate

Integrates #1323, #1324, #1325 and #1326: preserve nested field values, serve safe response/cache headers, retain published hydration/head/CSS, and enforce editor source permissions with parent-cycle prevention.

The private frontend package version matches the candidate. Stamp the Go executable using `-X github.com/primocms/primo/internal.buildVersion=v3.3.2-rc.2` and `-X github.com/primocms/primo/internal.buildTime=<RFC3339 UTC>`. Follow `.github/workflows/release.yml` with Node 22 and Go 1.25; the local candidate pins Go 1.25.14. Build Linux amd64/arm64, macOS amd64/arm64 and Windows amd64.

No tag, GitHub release, merge or deployment is authorized. In particular, publishing a matching v3 release triggers the image/deployment workflow even for prereleases. Review the four focused fixes separately; this integration branch demonstrates the combined candidate.

Editors remain trusted publishers of compiled output; content-only permissions protect design source records. A hostile-publisher sandbox is outside this contract. SMTP delivery, external hosting/CDN/TLS and concurrent-agency load require separate staging verification before launch.

RC.2 updates security-affected editor/build dependencies and tests with exact vendored CLI/MCP candidate tarballs. Scoped cookie/parser/esbuild overrides avoid a framework-major migration. Candidate native-platform CI tests disposable data and retains only tested bytes/provenance; no release or deployment actions run.
