# Stage 1: Build
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Serve
# nginx-unprivileged runs as uid 101 (non-root), listens on 8080 by default, and writes its pid to
# /tmp/nginx.pid -- so the container can run with runAsNonRoot + a read-only root filesystem (temp/cache
# dirs come from tmpfs/emptyDir mounts). Lets the k8s Deployment sit on the PSA `restricted` tier.
FROM nginxinc/nginx-unprivileged:1-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
