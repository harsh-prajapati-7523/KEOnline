import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";

const BASE_URL = (process.env.BASE_URL || "http://127.0.0.1:5173").replace(/\/+$/, "");
const EMPLOYEE_ID = process.env.EMPLOYEE_ID || "SUPER_ADMIN_001";
const PASSWORD = process.env.PASSWORD || "admin123";
const AUTH_TOKEN = process.env.AUTH_TOKEN || "";
const OUTPUT_DIR = process.env.OUTPUT_DIR || "qa-artifacts/performance-100k/results";
const MOBILE = process.env.MOBILE === "1";
const CAPTURE_SCREENSHOTS = process.env.CAPTURE_SCREENSHOTS === "1";
const SAMPLE_SEARCH = process.env.SAMPLE_SEARCH || "9000000001";
const SAMPLE_TICKET_ID = process.env.SAMPLE_TICKET_ID || "";

const viewport = MOBILE
  ? { width: 390, height: 844, isMobile: true }
  : { width: 1366, height: 900, isMobile: false };

async function measure(label, callback) {
  const startedAt = performance.now();
  await callback();
  const durationMs = Math.round((performance.now() - startedAt) * 10) / 10;
  console.log(`${label}: ${durationMs}ms`);
  return { label, durationMs };
}

async function screenshot(page, label) {
  if (!CAPTURE_SCREENSHOTS) return null;
  const filePath = path.join(OUTPUT_DIR, `${label}.png`);
  await page.screenshot({ path: filePath, fullPage: true });
  return filePath;
}

async function login(page) {
  if (AUTH_TOKEN) {
    await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded" });
    await page.evaluate(({ token, employeeId }) => {
      localStorage.setItem("token", token);
      localStorage.setItem("employeeName", "Bootstrap SUPER_ADMIN");
      localStorage.setItem("role", "SUPER_ADMIN");
      localStorage.setItem("employeeId", employeeId);
      localStorage.setItem("access", JSON.stringify({ superAdmin: true, access: {} }));
    }, { token: AUTH_TOKEN, employeeId: EMPLOYEE_ID });
    await page.goto(`${BASE_URL}/employee-dashboard`, { waitUntil: "networkidle" });
    return;
  }

  await page.goto(`${BASE_URL}/employee-login`, { waitUntil: "networkidle" });
  await page.getByLabel(/Employee ID/i).fill(EMPLOYEE_ID);
  await page.getByLabel(/Password/i).fill(PASSWORD);
  await Promise.all([
    page.waitForURL(/employee-dashboard|tickets/, { timeout: 30000 }),
    page.getByRole("button", { name: /^Login$/i }).click(),
  ]);
}

async function main() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: process.env.HEADED !== "1" });
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    isMobile: viewport.isMobile,
  });
  const page = await context.newPage();
  const results = [];

  try {
    results.push(await measure("login", async () => {
      await login(page);
      await page.getByRole("heading", { name: /Dashboard/i }).waitFor({ timeout: 30000 }).catch(() => {});
    }));
    await screenshot(page, "01-dashboard");

    results.push(await measure("create-ticket-screen", async () => {
      await page.goto(`${BASE_URL}/tickets/new`, { waitUntil: "networkidle" });
      await page.getByRole("heading", { name: /Create Ticket/i }).waitFor({ timeout: 30000 });
    }));
    await screenshot(page, "02-create-ticket");

    results.push(await measure("find-tickets-default", async () => {
      await page.goto(`${BASE_URL}/tickets/find`, { waitUntil: "networkidle" });
      await page.getByRole("heading", { name: /Find Tickets|Tickets/i }).waitFor({ timeout: 30000 }).catch(() => {});
    }));
    await screenshot(page, "03-find-tickets");

    results.push(await measure("find-tickets-search", async () => {
      await page.goto(`${BASE_URL}/tickets/find?search=${encodeURIComponent(SAMPLE_SEARCH)}`, { waitUntil: "networkidle" });
      await page.waitForLoadState("networkidle");
    }));
    await screenshot(page, "04-find-tickets-search");

    results.push(await measure("open-ticket-screen", async () => {
      await page.goto(`${BASE_URL}/tickets/open`, { waitUntil: "networkidle" });
      await page.getByRole("heading", { name: /Open Ticket/i }).waitFor({ timeout: 30000 });
    }));
    await screenshot(page, "05-open-ticket");

    if (SAMPLE_TICKET_ID) {
      results.push(await measure("ticket-detail", async () => {
        await page.goto(`${BASE_URL}/tickets/${encodeURIComponent(SAMPLE_TICKET_ID)}`, { waitUntil: "networkidle" });
        await page.waitForLoadState("networkidle");
      }));
      await screenshot(page, "06-ticket-detail");
    }

    const report = {
      generatedAt: new Date().toISOString(),
      baseUrl: BASE_URL,
      viewport,
      sampleSearch: SAMPLE_SEARCH,
      sampleTicketId: SAMPLE_TICKET_ID || null,
      results,
    };
    const outputPath = path.join(OUTPUT_DIR, `browser-performance-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
    await fs.writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
    console.log(`Wrote ${outputPath}`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
