# Moments - self-hosted photo frame. Single long-lived Node process (state on
# disk, in-process SSE), so this is a plain server image, not serverless.
FROM node:20-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/next.config.ts ./

# Photos and meta.json live here; mount a volume to persist them.
ENV MOMENTS_DATA_DIR=/data
VOLUME ["/data"]
EXPOSE 3000
CMD ["npm", "run", "start"]
