# Bounce Court — website

The landing page for the Android game in `../bounce-court`: what it is, how
it plays, the stage formations and brick kinds, the eleven perks, the twelve
power-ups, the eleven themes and thirteen medals, plus
the privacy policy and `app-ads.txt` that Play Console and AdMob need before
the app is live. The Google Play badge links to the listing. The owner
publishes the site when the game is published (or about to be), so the
page reads as a released game: no "coming soon".

Plain static files, no build step, no third-party requests (the font is
served from here). Bubble Pop's palette and the game's pixel font.

```
index.html            home: hero, how it plays, stages, perks, power-ups, themes, medals, about
privacy/index.html    privacy policy in effect, served at /privacy/ (link this URL in Play Console)
privacy/<date>.html   earlier versions, named by the date they took effect (noindex)
404.html              not-found page (noindex)
style.css             one stylesheet for every page
img/shots/            screenshots from the real game (tools/build-art.sh)
img/capsules/         the power-up capsules, img/perks/ the perk badges,
                      img/trophies/ the medals
img/formations/       the arena on each stage formation
img/icon.png          the game's launcher icon (JSON-LD image; also
                      favicon.png and apple-touch-icon.png)
img/social.png        1200x630 share card (tools/og-card.html)
img/google-play.png   the Play badge (from the Mood Dude site)
fonts/kenney_pixel.ttf  the game's display font (Kenney, CC0)
tools/build-art.sh    rebuilds every image above from the game
tools/og-card.html    source of img/social.png
tools/mobile-check.mjs  the pre-deploy phone check (playbook §11)
tools/policy.mjs      privacy policy versions, and a consistency check
app-ads.txt           AdMob authorised-seller line (same eiilo publisher as the other games)
robots.txt, sitemap.xml (with image entries), CNAME, .nojekyll
```

## Images

All the art comes from the game, so it stays in step with it:

```sh
tools/build-art.sh
```

It runs the game's `tools/site_art.gd` (Godot 4.7, needs a display; it plays
runs, so it backs up and restores the player's `user://` saves), then
converts with ImageMagick. Rerun it after the game's look changes.

### Share card

`img/social.png` is `tools/og-card.html` rendered by headless Chromium. With
the local server below running:

```sh
CH=$(ls ~/.cache/ms-playwright/chromium-*/chrome-linux64/chrome | head -1)
$CH --headless --disable-gpu --hide-scrollbars --window-size=1200,800 \
  --virtual-time-budget=3000 --screenshot=/tmp/og.png http://localhost:8000/tools/og-card.html
magick /tmp/og.png -crop 1200x630+0+0 +repage -strip -define png:compression-level=9 img/social.png
```

Render taller than 630 and crop: this Chromium's headless viewport comes
out shorter than `--window-size`, which cut the bottom off the card.
Re-scrape the card in Facebook's Sharing Debugger after deploy.

## TODO before deploy

- **The domain `bounce-court.com` is a CANDIDATE, not yet purchased.**
  Confirm the name (or pick another), buy it at OVH, and only then wire the
  DNS below. If the domain changes, update `CNAME`, every canonical /
  `og:url` / JSON-LD URL, `robots.txt` and `sitemap.xml`, plus the game's
  RELEASE.md and listing.
- The privacy policy is effective 25 October 2026 (first version). It
  covers premium-theme purchases through Google Play; keep it and the Data
  safety form in line.
- Mobile check before every deploy (below).

## Changing the privacy policy

Never edit the policy in place once it has been live. Start a new version:

```sh
node tools/policy.mjs new 2026-12-01 "Added crash reporting."
```

That archives the current page as `privacy/<old date>.html` (`noindex`, no
canonical or `og:url`, a notice saying when it was in effect and linking
the current one), moves `privacy/index.html` to the new date with a new row
on top of its "Changes and past versions" table, and bumps `sitemap.xml`.
Then edit `privacy/index.html` with the new wording, and check:

```sh
node tools/policy.mjs check   # archives linked, dates consistent, noindex, sitemap
node tools/policy.mjs list    # effective date and past versions
```

Publish the new policy before the app version that needs it ships, and
update the Data safety form to match. The tool relies on two markers in
the page; keep them when editing: `<time class="effective" datetime="…">`
inside `<p class="kicker">`, and `<tbody data-versions>` with one
`<tr data-current>` row. Adapted from the Mood Dude site's `policy.mjs`
(which handles several policies under `/privacy/<name>/`).

## Mobile check

Every page at 320, 390 and 412 px with touch emulation: fails on sideways
scroll, broken images or header/button taps under 44 px, and saves
full-page screenshots to look at:

```sh
npm i --prefix /tmp/pw playwright-core      # once
python3 -m http.server 8000 &
PLAYWRIGHT=/tmp/pw/node_modules/playwright-core/index.mjs \
CHROMIUM=$(ls ~/.cache/ms-playwright/chromium-*/chrome-linux64/chrome | head -1) \
node tools/mobile-check.mjs http://localhost:8000 /tmp/bc-mobile
```

Look at the screenshots too: a crushed table column (one letter per line)
passes the numbers. Also: `node tools/policy.mjs check`,
`xmllint --noout sitemap.xml`, and run the home page through Google's
Rich Results Test after deploy (the JSON-LD game entry).

## Run locally

```sh
python3 -m http.server 8000
# then open http://localhost:8000/
```

Links are root-absolute (`/privacy/`, `/style.css`), so the site must be
served from the root of a domain.

## Deploy

GitHub Pages, no build step: what is in `main` is what is served
(playbook §11).

1. Push to a public repository `eiilo-games/bounce-court-landing-page`.
2. Settings > Pages > Build and deployment: Source "Deploy from a branch",
   branch `main`, folder `/ (root)`.
3. Custom domain: `bounce-court.com` (already in `CNAME`). Once the DNS below
   resolves and the certificate is issued, tick **Enforce HTTPS**.
4. Verify the domain for the organisation, so no other GitHub account can
   claim it: org Settings > Pages > Verified domains > Add a domain, then add
   the `_github-pages-challenge-eiilo-games` TXT record it shows at OVH and
   click Verify.

DNS at OVH (Web Cloud > Domain names > `bounce-court.com` > DNS zone):

| Host  | Type  | Target                   |
|-------|-------|--------------------------|
| (apex)| A     | `185.199.108.153`        |
| (apex)| A     | `185.199.109.153`        |
| (apex)| A     | `185.199.110.153`        |
| (apex)| A     | `185.199.111.153`        |
| (apex)| AAAA  | `2606:50c0:8000::153`    |
| (apex)| AAAA  | `2606:50c0:8001::153`    |
| (apex)| AAAA  | `2606:50c0:8002::153`    |
| (apex)| AAAA  | `2606:50c0:8003::153`    |
| `www` | CNAME | `eiilo-games.github.io.` |

Delete OVH's default apex A record (`213.186.33.5`) and any default `www`
record (A, AAAA or CNAME) first; leftovers break the certificate. GitHub
redirects `www.bounce-court.com` to the apex.

## Day one after it is live

- **Search Console**: add a Domain property for `bounce-court.com` (DNS TXT
  record at OVH), submit `sitemap.xml` the same day, then URL-inspect the
  home page and the privacy page and click **Request indexing**. Validate
  any pre-launch "Not found (404)" entries once the site is up.
- Do the same in Bing Webmaster Tools (import from Search Console).
- **Link the site from eiilo.com** — those links are how Google discovers
  and trusts a new game domain.
- In Play Console (once the app exists) set the developer website to
  `https://bounce-court.com` (AdMob only checks
  `https://bounce-court.com/app-ads.txt`, at the root) and the privacy
  policy to `https://bounce-court.com/privacy/`; use the same URL in AdMob
  and keep the Data safety form in line with the policy.
