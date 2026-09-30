import { expect, test, type APIRequestContext } from "@playwright/test";

async function ingestTrack(request: APIRequestContext, trackId: string, siteId = "alder-harbor") {
  const now = new Date().toISOString();
  const response = await request.post("http://localhost:5000/api/ingest", {
    headers: { "x-ingest-key": "harborwatch-ingest-dev" },
    data: {
      type: "track",
      schema: "harborwatch.track/1",
      site_id: siteId,
      seq: Date.now() % 1_000_000,
      sent_at: now,
      payload: {
        track_id: trackId,
        object_type: "vessel",
        latitude: siteId === "cedar-inlet" ? 47.251 : 47.627,
        longitude: siteId === "cedar-inlet" ? -122.461 : -122.409,
        altitude: 0.4,
        speed_mps: 3.2,
        heading: 90,
        confidence: 0.9,
        sensor_id: siteId === "cedar-inlet" ? "LIDAR-C1" : "LIDAR-03",
        timestamp: now,
        last_seen: now,
      },
    },
  });
  expect(response.status()).toBe(202);
}

test("operator console, site switch, viewer cannot ack", async ({ page, request }) => {
  const alderId = `TRK-E2E-${Date.now()}`;
  const cedarId = `CI-E2E-${Date.now()}`;
  await ingestTrack(request, alderId);
  await ingestTrack(request, cedarId, "cedar-inlet");

  await page.goto("/");
  await page.getByRole("button", { name: "Operator" }).click();
  await expect(page.getByLabel("Site")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("operator@harborwatch.local")).toBeVisible();
  await expect(page.getByRole("button", { name: alderId })).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: alderId }).click();
  await expect(page.locator(".inspector dd").filter({ hasText: "LIDAR-03" })).toBeVisible();
  await expect(page.locator(".inspector")).toContainText("Latitude");
  await expect(page.locator(".inspector")).toContainText(/Speed history|No sampled history|Hdg/);

  await page.getByLabel("Site").selectOption("cedar-inlet");
  await expect(page.getByRole("button", { name: cedarId })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: alderId })).toHaveCount(0);

  await page.getByRole("button", { name: "Sign out" }).click();
  await page.getByRole("button", { name: "Viewer" }).click();
  await expect(page.getByLabel("Site")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("button", { name: "Ack" })).toHaveCount(0);

  await page.getByRole("button", { name: "Sign out" }).click();
  await page.getByRole("button", { name: "Admin" }).click();
  await expect(page.getByRole("button", { name: "Admin" })).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "Admin" }).click();
  await expect(page.getByText("Audit log")).toBeVisible();
});
