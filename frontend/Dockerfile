FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
# Kopiuj wszystkie pliki
COPY --from=build /app/dist /usr/share/nginx/html
# UPEWNIJ SIĘ że sw.js jest w root
COPY --from=build /app/dist/sw.js /usr/share/nginx/html/sw.js

# Opcjonalnie: kopiuj niestandardowy nginx.conf jeśli masz
# COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]