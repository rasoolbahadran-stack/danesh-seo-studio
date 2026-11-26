# ---------------------------------------------
# Multi-stage: build the whole monorepo, run the API
# (API also serves the built dashboard when present)
# ---------------------------------------------
FROM node:22.13-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
COPY packages/seo-engine/package.json packages/seo-engine/
COPY packages/content-analyzer/package.json packages/content-analyzer/
COPY packages/keyword-research/package.json packages/keyword-research/
COPY packages/ai-engine/package.json packages/ai-engine/
COPY packages/website-connectors/package.json packages/website-connectors/
COPY apps/api/package.json apps/api/
COPY apps/dashboard/package.json apps/dashboard/
RUN npm ci --no-audit --no-fund

COPY . .
RUN npm run build

FROM node:22.13-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=4000 DATABASE_PATH=/data/danesh-seo-studio.db
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/dashboard/dist ./apps/dashboard/dist
COPY --from=build /app/integrations/html ./integrations/html
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules/@danesh ./node_modules/@danesh
RUN mkdir -p /data
VOLUME /data
EXPOSE 4000
CMD ["node", "apps/api/dist/index.js"]
