# Stage 1: Build
FROM node:22-alpine@sha256:1314fb30ec37592d5845e5a160d522c0e680972aa534549940b8d73bde88481a AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Lint and tests run inside the image build, so `gate/build` (which is this build plus the scan) fails when
# either does. That is what lets Renovate automerge minor and patch updates safely: the bot's token cannot
# read check runs, so a separate lint/test job would never be seen by it. Doing it here also means the image
# that is published is the one that passed.
RUN npm run lint && npm test
RUN npm run build

# Stage 2: Serve
# Chainguard's nginx carries nginx and its few runtime libraries only: no shell, no package manager,
# no libxslt/libexpat/curl. It is rebuilt upstream as fixes land, and `latest` is the only tag it
# publishes for free, so the digest is the pin (Renovate bumps it). The container runs unprivileged on
# :8080 with a read-only root filesystem; the config keeps all writable paths under /tmp.
FROM cgr.dev/chainguard/nginx:latest@sha256:07295c9284f8db3f8ed77b74ee8ee5284e4372e05851aa2288bcbc881ebf8acf
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
COPY security-headers.conf /etc/nginx/security-headers.conf
EXPOSE 8080
