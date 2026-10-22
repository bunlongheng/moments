import { test, expect } from "@playwright/test";
import { clearE2EData, pngUpload } from "./helpers";

test.beforeEach(async () => {
    clearE2EData();
});

test.describe("Upload page", () => {
    test("renders the header, count and empty state", async ({ page }) => {
        await page.goto("/upload");
        await expect(page.getByRole("heading", { name: "Moments" })).toBeVisible();
        await expect(page.getByText("0 photos")).toBeVisible();
        await expect(page.getByRole("button", { name: "+ Add Photos" })).toBeVisible();
        await expect(page.getByText("Drop photos or tap + Add Photos")).toBeVisible();
    });

    test("shows the live preview iframe alongside the controls (no tabs)", async ({ page }) => {
        await page.goto("/upload");
        await expect(page.getByRole("button", { name: "+ Add Photos" })).toBeVisible();
        await expect(page.locator("iframe")).toHaveAttribute("src", "/");
        await expect(page.getByRole("button", { name: "preview" })).toHaveCount(0);
        await expect(page.getByRole("button", { name: "upload" })).toHaveCount(0);
    });

    test("renders all five style buttons", async ({ page }) => {
        await page.goto("/upload");
        for (const label of ["Ken Burns", "Fade", "Slide", "Zoom", "Static"]) {
            await expect(page.getByRole("button", { name: label })).toBeVisible();
        }
    });

    test("selecting a style shows a toast and persists across reload", async ({ page }) => {
        await page.goto("/upload");
        await page.getByRole("button", { name: "Slide" }).click();
        await expect(page.getByText("Style: Slide")).toBeVisible();
        await page.reload();
        await expect(page.getByRole("button", { name: "Slide" })).toHaveCSS("font-weight", "600");
    });

    test("uploads a photo via the file input", async ({ page }) => {
        await page.goto("/upload");
        await page.locator('input[type="file"]').setInputFiles(pngUpload());
        await expect(page.getByText("1 photos")).toBeVisible();
        await expect(page.locator('img[alt=""]')).toHaveCount(1);
        await expect(page.getByText(/Done! 1 added/)).toBeVisible();
    });

    test("uploads multiple photos at once", async ({ page }) => {
        await page.goto("/upload");
        await page.locator('input[type="file"]').setInputFiles([pngUpload("a.png"), pngUpload("b.png")]);
        await expect(page.getByText("2 photos")).toBeVisible();
        await expect(page.locator('img[alt=""]')).toHaveCount(2);
    });

    test("clicking a photo reveals the delete button and removes it", async ({ page }) => {
        await page.goto("/upload");
        await page.locator('input[type="file"]').setInputFiles(pngUpload());
        await expect(page.getByText("1 photos")).toBeVisible();

        await page.locator('img[alt=""]').first().click();
        const del = page.getByRole("button", { name: "×" });
        await expect(del).toBeVisible();
        await del.click();

        await expect(page.getByText("0 photos")).toBeVisible();
        await expect(page.locator('img[alt=""]')).toHaveCount(0);
    });

    test("long-press reveals a delete button that removes the photo", async ({ page }) => {
        await page.goto("/upload");
        await page.locator('input[type="file"]').setInputFiles(pngUpload());
        await expect(page.getByText("1 photos")).toBeVisible();

        await page.locator('img[alt=""]').first().dispatchEvent("touchstart");
        const del = page.getByRole("button", { name: "×" });
        await expect(del).toBeVisible();
        await del.click();

        await expect(page.getByText("0 photos")).toBeVisible();
        await expect(page.locator('img[alt=""]')).toHaveCount(0);
    });

    test("shows and hides the drag overlay", async ({ page }) => {
        await page.goto("/upload");
        await expect(page.getByRole("button", { name: "+ Add Photos" })).toBeVisible();
        // useEffect attaches drag listeners asynchronously after render; retry the dispatch
        // until the overlay appears. Check first so we never dispatch a second time once
        // the overlay is already visible (which would over-increment the drag counter).
        await page.waitForFunction(() => {
            if (document.body.textContent?.includes("Drop photos here")) return true;
            document.dispatchEvent(new Event("dragenter", { bubbles: true }));
            return false;
        });
        await expect(page.getByText("Drop photos here")).toBeVisible();
        // The retry loop above may have dispatched dragenter more than once if React's
        // re-render lagged behind the polling interval. Dispatch dragleave until the
        // overlay actually hides to balance however many dragenter events accumulated.
        await page.waitForFunction(() => {
            document.dispatchEvent(new Event("dragleave", { bubbles: true }));
            return !document.body.textContent?.includes("Drop photos here");
        });
        await expect(page.getByText("Drop photos here")).toBeHidden();
    });

    test("live preview reflects an uploaded photo", async ({ page }) => {
        await page.goto("/upload");
        await page.locator('input[type="file"]').setInputFiles(pngUpload());
        await expect(page.getByText("1 photos")).toBeVisible();
        const frame = page.frameLocator("iframe");
        await expect(frame.locator(".slide .fg")).toHaveCount(1);
    });

    test("rotating a photo replaces it with a new file", async ({ page }) => {
        await page.goto("/upload");
        await page.locator('input[type="file"]').setInputFiles(pngUpload());
        await expect(page.getByText("1 photos")).toBeVisible();

        const img = page.locator('img[alt=""]').first();
        const before = await img.getAttribute("src");
        await img.click();
        await page.getByRole("button", { name: "Rotate" }).click();

        await expect(page.locator('img[alt=""]').first()).not.toHaveAttribute("src", before!);
    });
});
