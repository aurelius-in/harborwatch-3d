FROM node:22-alpine
WORKDIR /repo
COPY package.json package-lock.json ./
COPY packages ./packages
COPY apps/api ./apps/api
COPY apps/web/package.json ./apps/web/package.json
RUN npm ci
EXPOSE 5000
CMD ["npm", "run", "start", "-w", "@harborwatch/api"]
