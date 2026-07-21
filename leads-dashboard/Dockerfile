FROM node:26.5.0-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install

# See frontend/Dockerfile for rationale. The dashboard can show its own build
# commit in the admin shell footer for the same "what's deployed?" debugging.
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
    PORT=3434
RUN addgroup -S nextjs && adduser -S nextjs -G nextjs
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
RUN chown -R nextjs:nextjs /app
USER nextjs
EXPOSE 3434
CMD ["node", "server.js"]
