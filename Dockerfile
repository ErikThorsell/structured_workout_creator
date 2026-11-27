# Stage 1: Build
FROM node:26-alpine@sha256:6bd9ab43c0ec0190ca7b2d193906cb8b7edf6e7f4afa43ddeccd6452710bffb5 AS build
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
FROM cgr.dev/chainguard/nginx:latest@sha256:5105f045f88c008d11cea5a102a4bb42ea8aedf671dfc6c826eb899c2b87d7e4
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
COPY security-headers.conf /etc/nginx/security-headers.conf
EXPOSE 8080
