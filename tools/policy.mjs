#!/usr/bin/env node
// Privacy policy versions, for a site with one policy (adapted from the
// Mood Dude site's tools/policy.mjs, which handles several). privacy/index.html
// is the version in effect, the URL Play Console links; privacy/<YYYY-MM-DD>.html
// is each earlier version, named by the date it took effect. Old versions are
// never deleted.
//
//   node tools/policy.mjs list
//   node tools/policy.mjs new <YYYY-MM-DD> "What changed"
//   node tools/policy.mjs check
//
// `new` archives the current version (noindex, no canonical or og:url, an
// "old version" notice), moves privacy/index.html to the new date, adds a row
// to its "Changes and past versions" table and bumps sitemap.xml. Then edit
// privacy/index.html with the new wording. `check` validates everything and
// exits non-zero on any problem; run it before every deploy.
//
// Markers the tool relies on (keep them when editing the policy):
//   <time class="effective" datetime="YYYY-MM-DD">Effective D Month YYYY</time>
//   <tbody data-versions> with one <tr data-current> row

import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PRIVACY = join(ROOT, "privacy");
const CURRENT = join(PRIVACY, "index.html");
const SITEMAP = join(ROOT, "sitemap.xml");
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const EFFECTIVE = /<time class="effective" datetime="(\d{4}-\d{2}-\d{2})">Effective [^<]+<\/time>/;

const read = (p) => readFileSync(p, "utf8");
const human = (iso) => { const [y, m, d] = iso.split("-").map(Number); return `${d} ${MONTHS[m - 1]} ${y}`; };
const dayBefore = (iso) => { const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10); };
const escape = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const plural = (n) => `${n} version${n === 1 ? "" : "s"}`;

function fail(msg) { console.error(`error: ${msg}`); process.exit(1); }

function archives() {
	return readdirSync(PRIVACY).filter((f) => f.endsWith(".html") && DATE.test(f.slice(0, -5))).map((f) => f.slice(0, 10)).sort();
}

function effective(html, file) {
	const m = html.match(EFFECTIVE);
	if (!m) fail(`${file}: no <time class="effective" datetime="YYYY-MM-DD">Effective ...</time> found`);
	return m[1];
}

function list() {
	const past = archives();
	console.log(`effective ${effective(read(CURRENT), "privacy/index.html")}   ${plural(past.length + 1)}${past.length ? `   past: ${past.join(", ")}` : ""}`);
}

function newVersion(date, summary) {
	if (!date || !summary) fail('usage: node tools/policy.mjs new <YYYY-MM-DD> "What changed"');
	if (!DATE.test(date) || isNaN(Date.parse(date))) fail(`${date} is not a YYYY-MM-DD date`);
	const html = read(CURRENT);
	const old = effective(html, "privacy/index.html");
	if (date <= old) fail(`the new date ${date} must be after the current effective date ${old}`);
	const archivePath = join(PRIVACY, `${old}.html`);
	if (existsSync(archivePath)) fail(`privacy/${old}.html already exists`);

	// 1. The archived copy: not indexed, not canonical, marked as old.
	const archive = html
		.replace('<meta charset="utf-8">', '<meta charset="utf-8">\n<meta name="robots" content="noindex">')
		.replace(/\n<link rel="canonical"[^>]*>/, "")
		.replace(/\n<meta property="og:url"[^>]*>/, "")
		.replace(/<title>([^<]*)<\/title>/, `<title>$1 (${human(old)} version)</title>`)
		.replace(/ aria-current="page"/, "")
		.replace(/(<p class="kicker"><time class="effective"[^\n]*<\/p>)/,
			`$1\n\t<div class="archived" role="note"><strong>This is an old version of this policy.</strong> It was in effect from ${human(old)} to ${human(dayBefore(date))}. <a href="/privacy/">Read the current policy</a>.</div>`);
	if (!archive.includes('class="archived"')) fail("could not insert the archived notice (is the effective date in <p class=\"kicker\">?)");
	writeFileSync(archivePath, archive);

	// 2. The current page: new date, and a new row on top of the history.
	let current = html.replace(EFFECTIVE, `<time class="effective" datetime="${date}">Effective ${human(date)}</time>`);
	const row = /<tr data-current><td>[^<]*\(this version\)<\/td>/;
	if (!row.test(current)) fail("privacy/index.html: no <tr data-current> row in the versions table");
	current = current.replace(row, `<tr><td><a href="/privacy/${old}.html">${human(old)}</a></td>`);
	current = current.replace(/(<tbody data-versions>\n?)(\s*)/, `$1$2<tr data-current><td>${human(date)} (this version)</td><td>${escape(summary)}</td></tr>\n$2`);
	writeFileSync(CURRENT, current);

	// 3. The sitemap: the policy's lastmod. Archives stay out (noindex).
	if (existsSync(SITEMAP)) {
		writeFileSync(SITEMAP, read(SITEMAP).replace(/(<loc>[^<]*\/privacy\/<\/loc>\s*<lastmod>)[^<]*/, `$1${date}`));
	}

	console.log(`archived  privacy/${old}.html (in effect ${old} to ${dayBefore(date)})`);
	console.log(`updated   privacy/index.html, now effective ${date}${existsSync(SITEMAP) ? ", and sitemap.xml" : ""}`);
	console.log("\nNow edit privacy/index.html with the new wording, then run: node tools/policy.mjs check");
}

function check() {
	const problems = [];
	const html = read(CURRENT);
	const m = html.match(EFFECTIVE);
	if (!m) fail("privacy/index.html: missing effective date");
	const current = m[1];
	const past = archives();

	if (/name="robots" content="noindex"/.test(html)) problems.push("privacy/index.html: the current version must not be noindex");
	if (!/rel="canonical" href="[^"]*\/privacy\/"/.test(html)) problems.push("privacy/index.html: needs its canonical /privacy/ URL");
	if (html.includes('class="archived"')) problems.push("privacy/index.html: the current version carries the archived notice");
	if ((html.match(/<tr data-current>/g) || []).length !== 1) problems.push("privacy/index.html: needs exactly one <tr data-current> row");
	const cur = html.match(/<tr data-current><td>([^<]*) \(this version\)/);
	if (cur && cur[1] !== human(current)) problems.push(`privacy/index.html: table says ${cur[1]} but the page is effective ${human(current)}`);

	const linked = [...html.matchAll(/<a href="\/privacy\/(\d{4}-\d{2}-\d{2})\.html">/g)].map((x) => x[1]);
	for (const d of linked) if (!past.includes(d)) problems.push(`privacy/index.html: links ${d}.html, which does not exist`);
	for (const d of past) if (!linked.includes(d)) problems.push(`privacy/index.html: ${d}.html is not listed in the versions table`);

	const dates = [...past, current];
	past.forEach((d, i) => {
		const a = read(join(PRIVACY, `${d}.html`));
		const until = dayBefore(dates[i + 1]);
		if (!/name="robots" content="noindex"/.test(a)) problems.push(`privacy/${d}.html: missing noindex`);
		if (/rel="canonical"/.test(a)) problems.push(`privacy/${d}.html: an old version must not be canonical`);
		if (/property="og:url"/.test(a)) problems.push(`privacy/${d}.html: an old version must not claim og:url`);
		const e = a.match(EFFECTIVE);
		if (!e || e[1] !== d) problems.push(`privacy/${d}.html: effective date does not match the file name`);
		if (!a.includes(`in effect from ${human(d)} to ${human(until)}`)) problems.push(`privacy/${d}.html: archived notice should read "in effect from ${human(d)} to ${human(until)}"`);
	});
	if (current <= (past.at(-1) ?? "")) problems.push(`privacy/index.html: current date ${current} is not after the last archive`);

	if (existsSync(SITEMAP)) {
		const sm = read(SITEMAP);
		const lm = sm.match(/<loc>[^<]*\/privacy\/<\/loc>\s*<lastmod>([^<]*)/);
		if (!lm) problems.push("sitemap.xml: no /privacy/ entry");
		else if (lm[1] < current) problems.push(`sitemap.xml: /privacy/ lastmod ${lm[1]} is before the effective date ${current}`);
		for (const d of past) if (sm.includes(`/privacy/${d}.html`)) problems.push(`sitemap.xml: lists the archived ${d}.html (archives are noindex)`);
	}

	if (problems.length) { for (const p of problems) console.error(`✗ ${p}`); process.exit(1); }
	console.log(`✓ privacy policy effective ${current}, ${plural(dates.length)}, all consistent`);
}

const [cmd, ...args] = process.argv.slice(2);
if (cmd === "list") list();
else if (cmd === "new") newVersion(...args);
else if (cmd === "check") check();
else fail('usage: node tools/policy.mjs list | new <YYYY-MM-DD> "What changed" | check');
