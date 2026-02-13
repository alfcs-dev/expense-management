FROM node:20-alpine AS web-builder

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app

ARG VITE_API_URL=""
ENV VITE_API_URL=${VITE_API_URL}

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json tsconfig.json tsconfig.base.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/trpc/package.json packages/trpc/package.json

RUN pnpm install --frozen-lockfile

COPY apps ./apps
COPY packages ./packages

RUN pnpm --filter @expense-management/trpc build \
  && pnpm --filter @expense-management/web build

FROM nginx:1.27-alpine
COPY docker/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=web-builder /app/apps/web/dist /usr/share/nginx/html

EXPOSE 80
