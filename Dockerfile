# syntax=docker/dockerfile:1

# Build in CI, never on the VPS. The final image keeps the custom `server.ts`
# entrypoint required for Socket.IO and runs it as an unprivileged user.
FROM node:22.22.1-bookworm-slim AS base

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV NEXT_TELEMETRY_DISABLED=1

RUN corepack enable && corepack prepare pnpm@10.28.0 --activate

WORKDIR /app

FROM base AS dependencies

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS production-dependencies

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile

FROM dependencies AS build

COPY . .

# Next.js embeds NEXT_PUBLIC_* values in browser bundles at build time. These
# are public configuration only; runtime secrets remain outside the image.
ARG NEXT_PUBLIC_APP_NAME=Gallurio
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_PORTFOLIO_BASE_DOMAIN
ARG NEXT_PUBLIC_WORKOS_REDIRECT_URI
ARG NEXT_PUBLIC_TURNSTILE_SITE_KEY
ARG NEXT_PUBLIC_CF_IMAGES_ACCOUNT_HASH
ARG NEXT_PUBLIC_SOCIAL_INSTAGRAM_URL
ARG NEXT_PUBLIC_SOCIAL_FACEBOOK_URL
ARG NEXT_PUBLIC_SOCIAL_REDDIT_URL
ARG NEXT_PUBLIC_SOCIAL_LINKEDIN_URL

# Some route modules construct the WorkOS SDK while Next collects route
# metadata. This inert build-only value never reaches the runtime image;
# production receives its real key only from /etc/gallurio/gallurio.env.
ENV NEXT_PUBLIC_APP_NAME=$NEXT_PUBLIC_APP_NAME \
  NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
  NEXT_PUBLIC_PORTFOLIO_BASE_DOMAIN=$NEXT_PUBLIC_PORTFOLIO_BASE_DOMAIN \
  NEXT_PUBLIC_WORKOS_REDIRECT_URI=$NEXT_PUBLIC_WORKOS_REDIRECT_URI \
  NEXT_PUBLIC_TURNSTILE_SITE_KEY=$NEXT_PUBLIC_TURNSTILE_SITE_KEY \
  NEXT_PUBLIC_CF_IMAGES_ACCOUNT_HASH=$NEXT_PUBLIC_CF_IMAGES_ACCOUNT_HASH \
  NEXT_PUBLIC_SOCIAL_INSTAGRAM_URL=$NEXT_PUBLIC_SOCIAL_INSTAGRAM_URL \
  NEXT_PUBLIC_SOCIAL_FACEBOOK_URL=$NEXT_PUBLIC_SOCIAL_FACEBOOK_URL \
  NEXT_PUBLIC_SOCIAL_REDDIT_URL=$NEXT_PUBLIC_SOCIAL_REDDIT_URL \
  NEXT_PUBLIC_SOCIAL_LINKEDIN_URL=$NEXT_PUBLIC_SOCIAL_LINKEDIN_URL \
  WORKOS_API_KEY=build_dummy_workos_api_key

RUN pnpm build

FROM node:22.22.1-bookworm-slim AS runtime

ENV NODE_ENV=production
ENV PORT=3000
ENV NEXT_TELEMETRY_DISABLED=1

WORKDIR /app

RUN groupadd --system --gid 1001 gallurio \
  && useradd --system --uid 1001 --gid gallurio --create-home gallurio

# `server.ts` is executed through tsx and imports these source modules directly;
# Next serves the built application from `.next`.
COPY --from=production-dependencies --chown=gallurio:gallurio /app/node_modules ./node_modules
COPY --from=build --chown=gallurio:gallurio /app/.next ./.next
COPY --from=build --chown=gallurio:gallurio /app/app ./app
COPY --from=build --chown=gallurio:gallurio /app/components ./components
COPY --from=build --chown=gallurio:gallurio /app/hooks ./hooks
COPY --from=build --chown=gallurio:gallurio /app/lib ./lib
COPY --from=build --chown=gallurio:gallurio /app/messages ./messages
COPY --from=build --chown=gallurio:gallurio /app/public ./public
COPY --from=build --chown=gallurio:gallurio /app/server.ts ./server.ts
COPY --from=build --chown=gallurio:gallurio /app/next.config.ts ./next.config.ts
COPY --from=build --chown=gallurio:gallurio /app/tsconfig.json ./tsconfig.json
COPY --from=build --chown=gallurio:gallurio /app/package.json ./package.json

USER gallurio

EXPOSE 3000

CMD ["./node_modules/.bin/tsx", "server.ts"]
