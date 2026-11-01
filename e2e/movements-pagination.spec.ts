/**
 * Movements scope-pagination regression (foundator report 2026-10-31).
 *
 * Root cause under test: the root proxy re-issued NEXT_LOCALE on server-action
 * responses. A mutating cookie on an action response makes the Next 16 router
 * re-render the current route in the same roundtrip; the re-render suspends
 * the page segment (loading.tsx swap) and REMOUNTS MovementsList, wiping the
 * client-side accumulated "Load more" state. Symptom: the FIRST click on a
 * scope tab's "Load more" appeared to refresh the page without appending
 * rows, and only a second click appended.
 * Fix: the proxy matcher now excludes requests carrying the `next-action`
 * header, so read-only actions return ONLY their value.
 *
 * This spec owns a private user (serial, self-contained) and seeds 56
 * Personal-context movements through the UI so the Personales tab pages over
 * 50 + 6: the FIRST "Load more" click must append the remaining 6 and expose
 * cursor exhaustion. Any first-click reset to page 1 fails the assertions.
 */
import { expect, test } from "@playwright/test";
import { registerUser } from "./helpers";

// TEMP instrumentation (H-16 repro): dump every POST /movements* response
// metrics to the reporter output; remove once the first-click reset is fixed.
test.beforeEach(() => {
  test.info().annotations.push({ description: "instrumented", type: "dbg" });
});

test.describe("Movements scope pagination (foundator 2026-10-31)", () => {
  // The single test owns its serial UI seed (56 dialogs) — give it room.
  test.setTimeout(360_000);

  test("first Load-more click on a scope tab appends rows and exhausts the cursor", async ({
    page,
  }) => {
    page.on("response", (res) => {
      const req = res.request();
      if (res.url().includes("/movements") && req.method() === "POST") {
        res
          .text()
          .then((body) => {
            console.log(
              `[DBG-POST] status=${res.status()} len=${body.length} nextCursor=${body.includes("nextCursor")} scopeBulk=${body.includes("scope-bulk-")}`,
            );
          })
          .catch(() => {
            console.log(`[DBG-POST] status=${res.status()} body=unreadable`);
          });
      }
    });
    await registerUser(page);

    // 56 personal movements: page 1 of the scoped stream holds 50, the rest
    // arrives only via the "Load more" cursor.
    for (let i = 1; i <= 56; i++) {
      await page.goto("/movements");
      const add = page.getByRole("button", { name: "Add Movement" });
      await add.click();
      const dialog = page.getByRole("dialog", { name: /New Movement/i });
      await expect(dialog).toBeVisible();
      await expect(dialog.getByLabel(/^Amount/)).toBeVisible();
      await dialog.getByLabel("Account").selectOption({ label: "Efectivo (COP)" });
      // Context must be picked EXPLICITLY: a movement submitted without it is
      // "neutral" (no context) and is deliberately excluded from both scope
      // tabs per EXC-1 (would make them invisible on Personales).
      await dialog.getByLabel("Context", { exact: true }).selectOption({ label: "Personal" });
      await dialog.getByLabel("Type").selectOption({ label: "Income" });
      await dialog.getByLabel("Category", { exact: true }).selectOption({ label: "Salario" });
      await dialog.getByLabel("Amount").fill(String(1000 + i * 7));
      await dialog.getByLabel("Note").fill(`scope-bulk-${i}`);
      await dialog.getByRole("button", { name: "Add Movement" }).click();
      await expect(dialog).toBeHidden();
    }

    // Tab switch server-refetches the scoped first page (50 of 56).
    // Locator regex is locale-tolerant: E2E runs with NEXT_LOCALE=en ("All"/
    // "Personal"), local browser sessions may render es ("Todos"/"Personales").
    await page.getByRole("tab", { name: /Personal/i }).click();
    const loadMore = page.getByRole("button", { name: /Load more|Cargar más/i });
    await expect(loadMore).toBeVisible();
    const scopeBulks = page.locator("text=scope-bulk-");
    await expect(scopeBulks).toHaveCount(50);

    // THE REGRESSION: the FIRST click must append the remaining 6 — before
    // the proxy fix it reset the list back to page 1 and left the button up.
    await loadMore.click();
    await expect(scopeBulks).toHaveCount(56);
    await expect(page.locator("text=scope-bulk-56")).toBeVisible();
    await expect(loadMore).toBeHidden();

    // The unscoped tab is ALSO paged over its own cursor (by design): its
    // first page shows the 50 newest; the Load-more appends the remaining 6
    // and the cursor exhausts.
    await page.getByRole("tab", { name: /\bAll\b/i }).click();
    const allLoadMore = page.getByRole("button", { name: /Load more/i });
    await expect(allLoadMore).toBeVisible();
    await expect(page.locator("text=scope-bulk-")).toHaveCount(50);
    await allLoadMore.click();
    await expect(page.locator("text=scope-bulk-")).toHaveCount(56);
    await expect(allLoadMore).toBeHidden();
  });
});
