FROM node:26.5.0-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install

# The commit SHA is passed by CI (build.yml) so the running build can link back
# to the exact GitHub commit it was built from. ARG before the build step +
# ENV to materialize it: Next.js only inlines NEXT_PUBLIC_* vars that exist as
# real env vars at `next build` time. Empty default keeps local `docker build`
# working without CI context (the UI then hides the version link).
ARG NEXT_PUBLIC_GIT_COMMIT_SHA=""
ENV NEXT_PUBLIC_GIT_COMMIT_SHA=$NEXT_PUBLIC_GIT_COMMIT_SHA

FROM node:26.5.0-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:26.5.0-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3333
RUN addgroup -S nextjs && adduser -S nextjs -G nextjs
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
RUN chown -R nextjs:nextjs /app
USER nextjs
EXPOSE 3333
CMD ["node", "server.js"]
