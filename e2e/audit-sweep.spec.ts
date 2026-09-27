import { test, expect, type Page, type Browser } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";
import { registerUser, login } from "./helpers";
import fs from "fs";
import path from "path";

/**
 * C12-9/C12-10 standalone audit sweep — axe-core WCAG scan + real responsive
 * screenshots in BOTH themes (light + dark). NOT part of the standing 35-test
 * suite: run it explicitly via
 *
 *   pnpm test:e2e -g "audit sweep" --retries=0
 *
 * Output (gitignored, survives review sessions until wiped):
 *   audit-output/responsive-shots/<route>-<viewport>[-dark].png
 *   audit-output/responsive-shots/index.html   (gallery for the owner review)
 *   audit-output/axe-report.json               (machine-readable findings)
 *
 * Scope:
 *  - Authenticated routes scanned with a real registered user + seeded data.
 *  - Public routes (landing/auth/legal) scanned with a fresh logged-out context.
 *  - Viewports per PROJECT-RULES responsive policy: 375 / 768 / 1280.
 *  - Dark mode via the app's own mechanism: localStorage["twincap-theme"]="dark"
 *    (ThemeProvider reads it on mount and toggles the `.dark` class on <html>).
 *  - axe tags: wcag2a, wcag2aa, wcag21aa, wcag22aa (no best-practice noise).
 *  - GATE: critical/serious violations fail the sweep; moderate/minor are
 *    recorded in the report for triage.
 */

const OUT_DIR = path.join(process.cwd(), "audit-output", "responsive-shots");

const THEMES = ["light", "dark"] as const;
type Theme = (typeof THEMES)[number];

const VIEWPORTS = [
  { name: "mobile-375", width: 375, height: 667 },
  { name: "tablet-768", width: 768, height: 1024 },
  { name: "desktop-1280", width: 1280, height: 800 },
];

/** Optional subset filter for fast diagnostic re-runs: AUDIT_ROUTES="/payables,/movements". */
const ROUTE_FILTER = process.env.AUDIT_ROUTES?.split(",").map((r) => r.trim());

const AUTH_ROUTES_ALL = [
  "/dashboard",
  "/movements",
  "/transfers",
  "/accounts",
  "/clients",
  "/credits/granted",
  "/credits/received",
  "/payables",
  "/pos/sales",
  "/pos/catalog",
  "/categories",
  "/profile",
  "/help",
] as const;

const AUTH_ROUTES: string[] = ROUTE_FILTER
  ? AUTH_ROUTES_ALL.filter((r) => ROUTE_FILTER.includes(r))
  : [...AUTH_ROUTES_ALL];

const PUBLIC_ROUTES = [
  "/",
  "/login",
  "/register",
  "/privacy",
  "/terms",
  "/cookies",
  "/data-policy",
];

const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];

interface AxeFinding {
  id: string;
  impact: string | undefined;
  help: string;
  route: string;
  viewport: string;
  theme: Theme;
  nodeCount: number;
  sampleTargets: string[];
  sampleHtml: string[];
  failureSummary: string;
}

function todayInputValue(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Seed enough data that populated pages render real content, not skeletons. */
async function seedRichData(page: Page): Promise<void> {
  // Two movements on the seeded Efectivo account.
  await page.goto("/movements");
  await page.getByRole("button", { name: "Add Movement" }).click();
  const movDialog = page.getByRole("dialog", { name: /New Movement/i });
  await expect(movDialog).toBeVisible();
  await movDialog.getByLabel("Account").selectOption({ label: "Efectivo (COP)" });
  await movDialog.getByLabel("Type").selectOption({ label: "Income" });
  await movDialog.getByLabel("Category", { exact: true }).selectOption({ label: "Salario" });
  await movDialog.getByLabel("Amount").fill("1200000");
  await movDialog.getByLabel("Note").fill("audit-sweep income");
  await movDialog.getByRole("button", { name: "Add Movement" }).click();
  await expect(movDialog).toBeHidden();

  await page.getByRole("button", { name: "Add Movement" }).click();
  await expect(movDialog).toBeVisible();
  await movDialog.getByLabel("Account").selectOption({ label: "Efectivo (COP)" });
  await movDialog.getByLabel("Type").selectOption({ label: "Expense" });
  await movDialog.getByLabel("Category", { exact: true }).selectOption({ label: "Comida" });
  await movDialog.getByLabel("Amount").fill("42000");
  await movDialog.getByLabel("Note").fill("audit-sweep expense");
  await movDialog.getByRole("button", { name: "Add Movement" }).click();
  await expect(movDialog).toBeHidden();

  // One received credit.
  await page.goto("/credits/received");
  await page.getByRole("button", { name: "Add Credit" }).click();
  const credDialog = page.getByRole("dialog", { name: /New Credit Received/i });
  await expect(credDialog).toBeVisible();
  await credDialog.getByLabel(/^Counterparty/).fill("Banco Acme");
  await credDialog.getByLabel(/^Principal/).fill("800000");
  await credDialog.getByLabel(/^Receiving Account/).selectOption({ label: "Efectivo (COP)" });
  await credDialog.getByLabel(/^Date/).fill(todayInputValue());
  await credDialog.getByRole("button", { name: /^Add Credit Received$/ }).click();
  await expect(credDialog).toBeHidden();

  // One payable.
  await page.goto("/payables");
  await page.getByRole("button", { name: "Add Payable" }).click();
  const payDialog = page.getByRole("dialog", { name: /New Payable/i });
  await expect(payDialog).toBeVisible();
  await payDialog.getByLabel(/^Counterparty/).fill("Proveedor Alfa");
  await payDialog.getByLabel(/^Total/).fill("300000");
  await payDialog.getByLabel(/^Paying Account/).selectOption({ label: "Efectivo (COP)" });
  await payDialog.getByLabel(/^Initial Payment/).fill("50000");
  await payDialog.getByLabel(/^Date/).fill(todayInputValue());
  await payDialog.getByRole("button", { name: "Add Payable" }).click();
  await expect(payDialog).toBeHidden();

  // One catalog item + one paid-in-full POS sale.
  await page.goto("/pos/catalog");
  await page.getByRole("button", { name: "Add product or service" }).click();
  const catDialog = page.getByRole("dialog", { name: /New product or service/i });
  await expect(catDialog).toBeVisible();
  await catDialog.getByLabel(/product or service name/i).fill("Widget Test");
  await catDialog.getByLabel(/^Unit Price/).fill("25000");
  await catDialog.getByLabel(/^Stock/).fill("100");
  await catDialog.getByRole("button", { name: /^Add to catalog$/ }).click();
  await expect(catDialog).toBeHidden();

  await page.goto("/pos/sales");
  await page.getByRole("button", { name: "New Sale" }).click();
  const saleDialog = page.getByRole("dialog", { name: /Create Sale/i });
  await expect(saleDialog).toBeVisible();
  await saleDialog.getByLabel(/^Payment Mode/).selectOption({ label: "Paid in Full" });
  await saleDialog.getByLabel(/^Account/).selectOption({ label: "Efectivo" });
  await saleDialog.getByLabel(/^Client/).selectOption({ label: "General Client" });
  await saleDialog.getByLabel(/^Date/).fill(todayInputValue());
  await saleDialog.locator("#item-search").fill("Widget Test");
  await saleDialog.getByRole("option", { name: /Widget Test/ }).click();
  await saleDialog.locator("#qty-0").fill("2");
  await saleDialog.getByRole("button", { name: /^Create Sale$/ }).click();
  await expect(saleDialog).toBeHidden();
}

async function scanAxe(
  page: Page,
  route: string,
  viewportName: string,
  theme: Theme,
  width: number,
  height: number,
): Promise<AxeFinding[]> {
  await page.setViewportSize({ width, height });
  await page.goto(route);
  await page.waitForLoadState("load");
  const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
  return results.violations.map((v): AxeFinding => ({
    id: v.id,
    impact: v.impact as string | undefined,
    help: v.help,
    route,
    viewport: viewportName,
    theme,
    nodeCount: v.nodes.length,
    sampleTargets: v.nodes.slice(0, 3).map((n) => n.target.join(" ")),
    sampleHtml: v.nodes.slice(0, 5).map((n) => n.html.slice(0, 200)),
    failureSummary: v.nodes
      .slice(0, 3)
      .map((n) => n.failureSummary ?? "")
      .join(" | ")
      .slice(0, 400),
  }));
}

/** Fresh logged-out context, honoring the theme via the app's localStorage key. */
async function newPublicContext(browser: Browser, theme: Theme) {
  const ctx = await browser.newContext();
  if (theme === "dark") {
    await ctx.addInitScript(() => localStorage.setItem("twincap-theme", "dark"));
  }
  return ctx;
}

test.setTimeout(1_800_000);

test("audit sweep: axe WCAG scan + responsive screenshots (light + dark)", async ({
  page,
  browser,
}) => {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  // 1. Real user + seeded data shared by BOTH theme passes.
  const email = await registerUser(page, {});
  await seedRichData(page);
  const creds = { email, password: "Password123!" };

  const findings: AxeFinding[] = [];
  const shots: string[] = [];

  for (const theme of THEMES) {
    const suffix = theme === "dark" ? "-dark" : "";

    // Authenticated page: the light pass reuses the registered main page; the
    // dark pass logs into a fresh context with the theme pref set.
    let authPage: Page;
    let darkAuthCtx = null;
    if (theme === "dark") {
      darkAuthCtx = await browser.newContext();
      await darkAuthCtx.addInitScript(() => localStorage.setItem("twincap-theme", "dark"));
      authPage = await darkAuthCtx.newPage();
      await login(authPage, creds);
    } else {
      authPage = page;
    }

    // 2. Screenshots: every authenticated route × 3 viewports.
    for (const route of AUTH_ROUTES) {
      for (const vp of VIEWPORTS) {
        await authPage.setViewportSize({ width: vp.width, height: vp.height });
        await authPage.goto(route);
        await authPage.waitForLoadState("load");
        await authPage.waitForTimeout(800); // let lazy RSC panels settle
        const file = `${route.replace(/\//g, "_")}-${vp.name}${suffix}.png`;
        await authPage.screenshot({ path: path.join(OUT_DIR, file), fullPage: true });
        shots.push(file);
      }
    }

    // 3. axe scan on authenticated routes (mobile + desktop; tablet rarely adds
    //    unique a11y findings and keeps the sweep faster).
    for (const route of AUTH_ROUTES) {
      for (const vp of [VIEWPORTS[0], VIEWPORTS[2]]) {
        findings.push(...(await scanAxe(authPage, route, vp.name, theme, vp.width, vp.height)));
      }
    }

    // 4. Public routes with a FRESH logged-out context: screenshots + axe.
    const pubCtx = await newPublicContext(browser, theme);
    const pub = await pubCtx.newPage();
    for (const route of PUBLIC_ROUTES) {
      for (const vp of VIEWPORTS) {
        await pub.setViewportSize({ width: vp.width, height: vp.height });
        await pub.goto(route);
        await pub.waitForLoadState("load");
        await pub.waitForTimeout(500);
        const file = `${route.replace(/\//g, "_")}-${vp.name}${suffix}.png`;
        await pub.screenshot({ path: path.join(OUT_DIR, file), fullPage: true });
        shots.push(file);
      }
    }
    for (const route of PUBLIC_ROUTES) {
      for (const vp of [VIEWPORTS[0], VIEWPORTS[2]]) {
        findings.push(...(await scanAxe(pub, route, vp.name, theme, vp.width, vp.height)));
      }
    }
    await pubCtx.close();
    if (darkAuthCtx) await darkAuthCtx.close();
  }

  // 5. Persist the machine-readable report + gallery.
  const blocking = findings.filter((f) => f.impact === "critical" || f.impact === "serious");
  fs.writeFileSync(path.join(OUT_DIR, "..", "axe-report.json"), JSON.stringify(findings, null, 2));

  const gallery = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>TwinCap responsive sweep — ${shots.length} shots</title>
<style>body{font-family:system-ui;background:#18181b;color:#fafafa;margin:2rem}
h1{font-size:1.2rem}h2{font-size:1rem;margin-top:2rem}.card{margin-bottom:1.5rem}.card img{max-width:100%;border:1px solid #3f3f46}
code{color:#a1a1aa}</style></head>
<body><h1>TwinCap responsive sweep — ${shots.length} screenshots (light + dark)</h1>
${THEMES.map(
  (theme) =>
    `<h2>${theme}</h2>\n` +
    shots
      .filter((f) => (theme === "dark" ? f.includes("-dark") : !f.includes("-dark")))
      .map(
        (f) =>
          `<div class="card"><div><code>${f}</code></div><img src="${f}" loading="lazy" alt="${f}"></div>`,
      )
      .join("\n"),
).join("\n")}</body></html>`;
  fs.writeFileSync(path.join(OUT_DIR, "index.html"), gallery);

  console.log(`[audit-sweep] screenshots: ${shots.length} → audit-output/responsive-shots/`);
  console.log(
    `[audit-sweep] axe findings: ${findings.length} total, ${blocking.length} critical/serious`,
  );
  for (const f of findings) {
    console.log(
      `[axe] ${f.impact ?? "unknown"} | ${f.route} (${f.viewport}, ${f.theme}) | ${f.id}: ${f.help} (${f.nodeCount} nodes)`,
    );
  }

  // 6. GATE: critical/serious must be zero in BOTH themes.
  expect(
    blocking,
    `axe critical/serious violations:\n${JSON.stringify(blocking, null, 2).slice(0, 3000)}`,
  ).toHaveLength(0);
});
