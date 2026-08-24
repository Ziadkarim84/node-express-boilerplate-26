# ---------- Build stage ----------
FROM node:24-slim AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build

# Remove dev dependencies for the runtime image
RUN npm prune --omit=dev

# ---------- Runtime stage ----------
FROM node:24-slim AS runtime

ENV NODE_ENV=production

# Surface the built commit in /v1/health (pass with --build-arg GIT_COMMIT=$(git rev-parse HEAD))
ARG GIT_COMMIT=N/A
ENV GIT_COMMIT=$GIT_COMMIT

WORKDIR /app

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
COPY schema-migrations ./schema-migrations
COPY scripts ./scripts
COPY .synorrc.cjs ./

# Run as the unprivileged user that ships with the node image
USER node

EXPOSE 8080

CMD ["node", "dist/index.js"]
