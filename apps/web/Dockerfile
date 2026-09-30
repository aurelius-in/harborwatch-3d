FROM node:22-alpine AS build
WORKDIR /repo
COPY package.json package-lock.json ./
COPY packages ./packages
COPY apps/web ./apps/web
COPY scripts ./scripts
COPY hw3d-logo.png ./hw3d-logo.png
COPY hw3d-logo-loop.gif ./hw3d-logo-loop.gif
RUN npm ci
RUN npm run build -w @harborwatch/web

FROM nginx:1.27-alpine
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
EXPOSE 3000
