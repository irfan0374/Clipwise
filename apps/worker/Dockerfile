# Clipwise worker: writes, voices and renders videos (Remotion = headless Chrome + ffmpeg).
# During the private beta the worker runs on the owner's Mac (pnpm worker:live); this image is for moving it to a
# server later. Build from the repo root:
#   docker build -f apps/worker/Dockerfile -t clipwise-worker .
#   docker run --env-file .env.live -e CLIPWISE_ENV=live clipwise-worker
# Needs about 2 GB of memory. Settings come from the environment (never baked into the image).

FROM node:22-bookworm-slim

# Libraries Chrome needs, plus fonts for any text that isn't in the video's own web font.
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates libnss3 libdbus-1-3 libatk1.0-0 libatk-bridge2.0-0 libgbm1 libasound2 \
      libxrandr2 libxkbcommon0 libxfixes3 libxcomposite1 libxdamage1 libpango-1.0-0 libcairo2 libcups2 \
      fonts-liberation fonts-noto-color-emoji \
    && rm -rf /var/lib/apt/lists/*

RUN corepack enable
WORKDIR /app
RUN chown node:node /app
USER node

# Dependencies first (cached until a package.json or the lockfile changes).
COPY --chown=node:node package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY --chown=node:node apps/worker/package.json apps/worker/
COPY --chown=node:node packages/db/package.json packages/db/
COPY --chown=node:node packages/pipeline/package.json packages/pipeline/
COPY --chown=node:node packages/queue/package.json packages/queue/
COPY --chown=node:node packages/shared/package.json packages/shared/
COPY --chown=node:node packages/storage/package.json packages/storage/
COPY --chown=node:node packages/video/package.json packages/video/
RUN CI=1 pnpm install --frozen-lockfile --filter "@clipwise/worker..."

COPY --chown=node:node packages packages
COPY --chown=node:node apps/worker apps/worker

# Download Remotion's Chrome now, so the first render doesn't wait for it. On Linux the renderer uses the
# headless shell (see chromeMode in packages/pipeline/src/stages/render.ts).
RUN cd packages/pipeline && node -e "require('@remotion/renderer').ensureBrowser({ chromeMode: 'headless-shell' }).then(() => console.log('chrome ready'))"

ENV NODE_ENV=production
# Start tsx directly, not through pnpm: pnpm would re-check (and download) packages on every start, and the
# stop signal must reach the worker itself so it can finish shutting down cleanly.
WORKDIR /app/apps/worker
CMD ["./node_modules/.bin/tsx", "src/index.ts"]
