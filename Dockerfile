FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update \
	&& apt-get install -y --no-install-recommends python3 make g++ \
	&& rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS build
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:22-bookworm-slim AS runner
RUN apt-get update \
	&& apt-get install -y --no-install-recommends gosu ca-certificates \
	&& rm -rf /var/lib/apt/lists/* \
	&& groupadd --gid 1001 nodeapp \
	&& useradd --uid 1001 --gid nodeapp --create-home nodeapp \
	&& mkdir -p /data \
	&& chown nodeapp:nodeapp /data
WORKDIR /app
ENV NODE_ENV=production \
	PORT=3000 \
	HOST=0.0.0.0 \
	DATABASE_PATH=/data/pokedex.db \
	TZ=America/Sao_Paulo \
	PROTOCOL_HEADER=x-forwarded-proto \
	HOST_HEADER=x-forwarded-host \
	ADDRESS_HEADER=x-forwarded-for \
	BODY_SIZE_LIMIT=1048576
COPY --from=build --chown=nodeapp:nodeapp /app/build ./build
COPY --from=build --chown=nodeapp:nodeapp /app/node_modules ./node_modules
COPY --from=build --chown=nodeapp:nodeapp /app/package.json ./package.json
COPY --chown=nodeapp:nodeapp scripts/issue-setup-code.mjs scripts/seed.mjs scripts/generate-vapid.mjs ./scripts/
COPY --chown=nodeapp:nodeapp docs/example-payload.json ./docs/example-payload.json
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
USER root
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
	CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["/entrypoint.sh"]
