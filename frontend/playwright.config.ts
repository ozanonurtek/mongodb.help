import { defineConfig, devices } from "@playwright/test";

// E2E spins up isolated backend + frontend containers (the project images) so it
// doesn't depend on the host Python toolchain. They share the compose MongoDB
// (exposed on host :27018). Answers come from the MongoDB Knowledge Service —
// grounded and cited, which is what the assertions check.
const MONGO = "mongodb://root:rootpass@host.docker.internal:27018/mongodbhelp?authSource=admin";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60000,
  use: {
    baseURL: process.env.BASE_URL || "http://localhost:3334",
    trace: "on-first-retry",
  },
  webServer: [
    {
      command: `docker run --rm -p 8889:8888 --add-host=host.docker.internal:host-gateway ` +
        `-e MONGODB_URI='${MONGO}' -e ANON_DAILY_CHATS=50 -e ANON_MESSAGES_PER_CHAT=3 ` +
        `-e CORS_ORIGINS='*' mongodb-help-agentic-backend`,
      url: "http://localhost:8889/api/health",
      reuseExistingServer: false,
      timeout: 90000,
      stdout: "ignore",
      stderr: "pipe",
    },
    {
      command: `docker run --rm -p 3334:3334 --add-host=host.docker.internal:host-gateway ` +
        `-e PORT=3334 -e BACKEND_URL=http://host.docker.internal:8889 ` +
        `-e AUTH_TRUST_HOST=1 -e AUTH_SECRET=e2e-secret -e MONGODB_URI='${MONGO}' ` +
        `mongodb-help-agentic-frontend`,
      url: "http://localhost:3334",
      reuseExistingServer: false,
      timeout: 120000,
      stdout: "ignore",
      stderr: "pipe",
    },
  ],
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
