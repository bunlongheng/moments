import { test, expect } from "@playwright/test";
import { clearE2EData, pngUpload } from "./helpers";

test.beforeEach(async () => {
    clearE2EData();
});

test.describe("Display page", () => {
    test("shows the empty state when there are no photos", async ({ page }) => {
        await page.goto("/");
        await expect(page.getByText("Moments")).toBeVisible();
        await expect(page.getByText("/upload")).toBeVisible();
    });

    test("renders a slide once a photo has been added", async ({ page, request }) => {
        const res = await request.post("/api/upload", { multipart: { file: pngUpload() } });
        expect(res.ok()).toBeTruthy();

        await page.goto("/");
        await expect(page.locator("img.slide")).toHaveCount(1);
        await expect(page.getByText("/upload")).toBeHidden();
    });

    test("shows a scan-to-add QR on the empty state", async ({ page }) => {
        await page.goto("/");
        await expect(page.getByText("Scan to add photos")).toBeVisible();
        await expect(page.getByAltText("Scan to add photos")).toBeVisible();
    });

    test("displays a clock with the current time", async ({ page, request }) => {
        await request.post("/api/upload", { multipart: { file: pngUpload() } });
        await page.goto("/");
        await expect(page.getByText(/\d{1,2}:\d{2}/)).toBeVisible();
    });
});
