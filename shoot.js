const { chromium } = require("playwright");

const DIR = process.argv[2] || ".";

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
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    permissions: ["camera", "microphone"],
  });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("[pageerror]", e.message.slice(0, 200)));
  page.on("console", (m) => {
    const t = m.text();
    if (/error|fail|frozenRef|undefined/i.test(t)) console.log("[console]", t.slice(0, 160));
  });

  await page.goto("http://localhost:3000", { waitUntil: "load" });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: DIR + "/01-welcome.png" });
  console.log("shot welcome");

  // Start session
  await page.getByRole("button", { name: /start session/i }).click();
  await page.waitForTimeout(4000);
  await page.screenshot({ path: DIR + "/02-session.png" });
  console.log("shot session");

  // Trigger analyse
  try {
    await page.getByRole("button", { name: /analyse frame/i }).click();
    await page.waitForTimeout(2500);
    await page.screenshot({ path: DIR + "/03-thinking.png" });
    console.log("shot thinking");
    await page.waitForTimeout(8000);
    await page.screenshot({ path: DIR + "/04-answer.png" });
    console.log("shot answer");
    // open the visual explanation panel
    await page.getByRole("button", { name: /show visual explanation/i }).click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: DIR + "/05-panel.png" });
    console.log("shot panel");
    // close panel + go back to live, then Point-and-Ask (tap a region)
    await page.getByRole("button", { name: /close panel/i }).click();
    await page.waitForTimeout(600);
    await page.getByRole("button", { name: /live view/i }).click();
    await page.waitForTimeout(1500);
    await page.mouse.click(195, 470); // tap a region on the live camera
    await page.waitForTimeout(2500);
    await page.screenshot({ path: DIR + "/06-pointask-thinking.png" });
    await page.waitForTimeout(7000);
    await page.screenshot({ path: DIR + "/07-pointask-answer.png" });
    console.log("shot point-and-ask");
  } catch (e) {
    console.log("analyse failed:", e.message.slice(0, 160));
  }

  await browser.close();
  console.log("done");
})().catch((e) => {
  console.log("FATAL", e.message.slice(0, 300));
  process.exit(1);
});
