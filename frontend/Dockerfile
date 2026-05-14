# PrivAI frontend — built with Vite, served as static files by nginx.

# --- build stage ---------------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
# Runs "tsc && vite build" — output goes to /app/dist
RUN npm run build

# --- serve stage ---------------------------------------------------------
FROM nginx:alpine
# Static SPA bundle.
COPY --from=build /app/dist /usr/share/nginx/html
# nginx serves the SPA and proxies /api/* to the backend container.
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
