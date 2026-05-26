import { defineConfig, devices } from "@playwright/test";
import fs from "fs";

// Use pre-installed browsers in the managed cloud environment when present.
if (fs.existsSync("/opt/pw-browsers") && !process.env.PLAYWRIGHT_BROWSERS_PATH) {
    process.env.PLAYWRIGHT_BROWSERS_PATH = "/opt/pw-browsers";
}

const PORT = 3210;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
    testDir: "./tests/e2e",
    fullyParallel: false,
    workers: 1,
    forbidOnly: !!process.env.CI,
    retries: 0,
    reporter: [["list"]],
    timeout: 60_000,
    expect: { timeout: 15_000 },
    use: {
        baseURL: BASE_URL,
        trace: "on-first-retry",
        actionTimeout: 15_000,
        hasTouch: true,
    },
    projects: [
        { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    ],
    webServer: {
        command: `npm run dev -- --port ${PORT}`,
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        env: { ...process.env, MOMENTS_DATA_DIR: ".e2e-data" },
    },
});
