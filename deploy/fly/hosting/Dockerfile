FROM --platform=$BUILDPLATFORM golang:1.25-alpine AS builder
ARG TARGETOS
ARG TARGETARCH
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY hosting ./hosting
COPY cmd/primo-hosting ./cmd/primo-hosting
RUN CGO_ENABLED=0 GOOS=$TARGETOS GOARCH=$TARGETARCH go build -trimpath -o /out/primo-hosting ./cmd/primo-hosting

FROM --platform=$BUILDPLATFORM alpine:3.22 AS flycli
ARG TARGETARCH
RUN apk add --no-cache ca-certificates
# Official Fly CLI release, with platform-specific checksums from GitHub.
RUN case "$TARGETARCH" in \
      amd64) archive=x86_64; digest=1878d7fb1f8a418039042cf0749e4b7216c6c7018b66ae10611a64c2b6d9aa9e ;; \
      arm64) archive=arm64; digest=964db79665d7ab97af3ba5af6b35f33677ca61dcb4bcef9d6a388d46481cb312 ;; \
      *) exit 1 ;; \
    esac && \
    wget -q -O /tmp/fly.tar.gz "https://github.com/superfly/flyctl/releases/download/v0.4.111/flyctl_0.4.111_Linux_${archive}.tar.gz" && \
    echo "$digest  /tmp/fly.tar.gz" | sha256sum -c - && \
    tar -xzf /tmp/fly.tar.gz -C /tmp flyctl

FROM alpine:3.22
RUN apk add --no-cache ca-certificates && mkdir -p /data /app && chmod 700 /data
COPY --from=builder /out/primo-hosting /app/primo-hosting
COPY --from=flycli /tmp/flyctl /usr/local/bin/flyctl
ENV FLY_CONFIG_DIR=/data/fly-config
WORKDIR /app
EXPOSE 8080
CMD ["/app/primo-hosting"]
