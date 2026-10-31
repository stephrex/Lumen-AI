const { chromium } = require("playwright");
const fs = require("fs");

const OUT = process.argv[2] || ".";

(async () => {
  const browser = await chromium.launch({
    channel: "chrome",
    headless: true,
    args: [
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
      "--autoplay-policy=no-user-gesture-required",
    ],
  });
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    permissions: ["camera", "microphone"],
    recordVideo: { dir: OUT, size: { width: 390, height: 844 } },
  });
  const page = await ctx.newPage();
  const wait = (ms) => page.waitForTimeout(ms);

  await page.goto("http://localhost:3000", { waitUntil: "load" });
  await wait(2500); // welcome

  await page.getByRole("button", { name: /start session/i }).click();
  await wait(3500); // HUD + camera

  // ambient on
  try { await page.getByRole("button", { name: /toggle ambient/i }).click(); await wait(1500); } catch {}

  // analyse
  await page.getByRole("button", { name: /analyse frame/i }).click();
  await wait(2500);  // thinking / reticle
  await wait(7000);  // answer: boxes + caption + chips

  // tap a suggestion chip
  try {
    const chip = page.getByRole("button", { name: /explain more simply/i });
    await chip.click();
    await wait(7000);
  } catch {}

  // open visual panel
  try { await page.getByRole("button", { name: /show visual explanation/i }).click(); await wait(3000); } catch {}
  try { await page.getByRole("button", { name: /close panel/i }).click(); await wait(1200); } catch {}

  // back to live
  try { await page.getByRole("button", { name: /live view/i }).click(); await wait(2000); } catch {}

  await ctx.close(); // flush video
  await browser.close();

  // rename the generated webm
  const files = fs.readdirSync(OUT).filter((f) => f.endsWith(".webm"));
  if (files.length) {
    const newest = files
      .map((f) => ({ f, t: fs.statSync(OUT + "/" + f).mtimeMs }))
      .sort((a, b) => b.t - a.t)[0].f;
    const dest = OUT + "/lumen-demo.webm";
    try { fs.renameSync(OUT + "/" + newest, dest); } catch {}
    console.log("VIDEO:", dest);
  } else {
    console.log("no video produced");
  }
})().catch((e) => { console.log("FATAL", e.message); process.exit(1); });
