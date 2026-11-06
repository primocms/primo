FROM --platform=linux/amd64 debian:trixie-slim@sha256:a29215f6a35e51e22adffa17f89e9d2ef06214e64a2bad10d765c46aea49f11f AS verified
WORKDIR /candidate
COPY primo /candidate/primo
COPY native.sha256 /candidate/native.sha256
RUN ["sha256sum", "--check", "--strict", "native.sha256"]
FROM --platform=linux/amd64 gcr.io/distroless/base-debian13@sha256:389cad21f73e4c37b94ffe5b13736d5a92bd5bd3c6c6b38c2be1c881e14ba2bd
WORKDIR /data
COPY --from=verified --chmod=0755 /candidate/primo /app/primo
COPY rc7-provenance.json /app/rc7-provenance.json
ENV PRIMO_DEV_MODE=0 PRIMO_AUTHOR_MODE=both PRIMO_ENABLE_USAGE_STATS=false PRIMO_DOMAIN_PROVIDER=manual
EXPOSE 8080
ENTRYPOINT ["/app/primo", "serve", "--http=0.0.0.0:8080", "--dir=/data/pb_data"]
