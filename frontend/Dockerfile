FROM node:22-alpine AS build

WORKDIR /app

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./

ARG VITE_API_BASE=/api
ARG VITE_WS_PATH=/api/ws/events
ARG VITE_DEMO_MODE=false
ARG VITE_DEMO_PASSWORD=
ENV VITE_API_BASE=$VITE_API_BASE \
    VITE_WS_PATH=$VITE_WS_PATH \
    VITE_DEMO_MODE=$VITE_DEMO_MODE \
    VITE_DEMO_PASSWORD=$VITE_DEMO_PASSWORD

RUN npm run build && npm run check:build-secrets

FROM nginxinc/nginx-unprivileged:1.27-alpine

COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY frontend/nginx-security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080

HEALTHCHECK --interval=20s --timeout=4s --start-period=10s --retries=4 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
