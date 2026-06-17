FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
# Kopiuj pliki
COPY --from=build /app/dist /usr/share/nginx/html
COPY --from=build /app/dist/sw.js /usr/share/nginx/html/sw.js

# Dodaj konfigurację nginx z prawidłowym MIME dla sw.js
RUN echo 'server { \
    listen 80; \
    root /usr/share/nginx/html; \
    index index.html; \
    location /sw.js { \
        types { application/javascript js; } \
        default_type application/javascript; \
        add_header Cache-Control "no-cache, no-store, must-revalidate"; \
        add_header Service-Worker-Allowed "/"; \
    } \
    location / { \
        try_files $uri $uri/ /index.html; \
        add_header Cache-Control "no-cache, no-store, must-revalidate"; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]