// Mobile check (playbook §11): every page at 320, 390 and 412 px wide with
// touch emulation. Fails if the page scrolls sideways
// (document.documentElement.scrollWidth wider than the screen), if an image
// is missing, or if a link or button is under 44 px tall. Saves a full-page
// screenshot of each to the directory given (default /tmp/bc-mobile).
//
// Needs playwright-core and a Chromium (the one Playwright installs is fine):
//   npm i --prefix /tmp/pw playwright-core
//   python3 -m http.server 8000 &
//   PLAYWRIGHT=/tmp/pw/node_modules/playwright-core/index.mjs \
//   CHROMIUM=~/.cache/ms-playwright/chromium-*/chrome-linux64/chrome \
//   node tools/mobile-check.mjs http://localhost:8000 /tmp/bc-mobile
import { mkdirSync } from "node:fs";

const { chromium } = await import(process.env.PLAYWRIGHT ?? "playwright-core");
const base = process.argv[2] ?? "http://localhost:8000";
const out = process.argv[3] ?? "/tmp/bc-mobile";
const pages = ["/", "/privacy/", "/404.html"];
const widths = [320, 390, 412];
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM });
let failures = 0;
for (const width of widths) {
	const context = await browser.newContext({
		viewport: { width, height: 780 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
	});
	const page = await context.newPage();
	for (const path of pages) {
		await page.goto(base + path, { waitUntil: "networkidle" });
		// Lazy images: scroll through so they load before measuring.
		await page.evaluate(async () => {
			for (let y = 0; y < document.body.scrollHeight; y += 400) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 30)); }
			window.scrollTo(0, 0);
		});
		await page.waitForLoadState("networkidle");
		const r = await page.evaluate(() => ({
			scroll: document.documentElement.scrollWidth,
			screen: window.innerWidth,
			broken: [...document.images].filter(i => i.complete && i.naturalWidth === 0).map(i => i.getAttribute("src")),
			small: [...document.querySelectorAll("header a, .button, .badge, .skip:focus")]
				.filter(e => e.getBoundingClientRect().height > 0 && e.getBoundingClientRect().height < 44)
				.map(e => `${e.textContent.trim() || e.className} (${Math.round(e.getBoundingClientRect().height)} px)`),
		}));
		const bad = r.scroll > r.screen || r.broken.length || r.small.length;
		if (bad) failures++;
		console.log(`${bad ? "FAIL" : "ok  "} ${width}px ${path}  scrollWidth ${r.scroll}/${r.screen}` +
			(r.broken.length ? `  broken: ${r.broken.join(", ")}` : "") +
			(r.small.length ? `  small taps: ${r.small.join(", ")}` : ""));
		await page.screenshot({ path: `${out}/${width}${path.replace(/\W+/g, "_") || "_"}.png`, fullPage: true });
	}
	await context.close();
}
await browser.close();
process.exit(failures ? 1 : 0);
