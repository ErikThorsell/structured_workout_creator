# Stage 1: Build
FROM node:22-alpine@sha256:1314fb30ec37592d5845e5a160d522c0e680972aa534549940b8d73bde88481a AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Serve
# Chainguard's nginx carries nginx and its few runtime libraries only: no shell, no package manager,
# no libxslt/libexpat/curl. It is rebuilt upstream as fixes land, and `latest` is the only tag it
# publishes for free, so the digest is the pin (Renovate bumps it). The container runs unprivileged on
# :8080 with a read-only root filesystem; the config keeps all writable paths under /tmp.
FROM cgr.dev/chainguard/nginx:latest@sha256:3efdf56b9730d56a9bc88edf268ab72ee965cbb7d116291a8679cd89ef67e0c5
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
COPY security-headers.conf /etc/nginx/security-headers.conf
EXPOSE 8080
