FROM --platform=$BUILDPLATFORM node:22-alpine AS node-builder

# Copy all the files that are not in .dockerignore
COPY . /app
WORKDIR /app

# Build frontend
RUN npm install
RUN npx svelte-kit sync
RUN npx vite --config common.config.js build
RUN npx vite --config app.config.js build

FROM --platform=$BUILDPLATFORM golang:1.25-alpine AS go-builder

# These arguments can be overridden on build
ARG TARGETOS
ARG TARGETARCH
ARG PRIMO_VERSION

# Copy all the files that are not in .dockerignore
COPY . /app
WORKDIR /app

# Copy built frontend
COPY --from=node-builder /app/internal/build /app/internal/build
COPY --from=node-builder /app/internal/common /app/internal/common

# Build executable
RUN GOOS=$TARGETOS GOARCH=$TARGETARCH \
  go build -o primo -ldflags "\
    -X 'github.com/primocms/primo/internal.buildTime=$(date --utc -Iseconds)'\
    -X 'github.com/primocms/primo/internal.buildVersion=$PRIMO_VERSION'\
  "

FROM alpine:3 AS runtime

ENV PRIMO_SUPERUSER_EMAIL=
ENV PRIMO_SUPERUSER_PASSWORD=
ENV PRIMO_USER_EMAIL=
ENV PRIMO_USER_PASSWORD=

# Copy build executable
COPY --from=go-builder /app/primo /app/primo

EXPOSE 8080
WORKDIR /app

CMD ["./primo", "serve", "--http=0.0.0.0:8080"]
