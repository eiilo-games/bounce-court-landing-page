#!/usr/bin/env bash
# Builds every image on the site from the game in ../bounce-court:
#   img/shots/<theme>.webp, hero.webp, powerups.webp, tutorial.webp,
#                                 perks.webp, stages.webp
#   img/formations/<name>.webp    the arena on each stage formation
#   img/capsules/<kind>.png       the power-up capsules
#   img/perks/<id>.png            the perk badges
#   img/trophies/<key>.webp       the achievement medals
#   img/icon.png (512), favicon.png (64), apple-touch-icon.png (180),
#                                 from the game's launcher icon
#   fonts/kenney_pixel.ttf        the game's display font (CC0)
# The share card img/social.png is separate (tools/og-card.html, README).
#
# Needs Godot 4.7 and a display (the capture renders the real game), and
# ImageMagick. The capture plays runs, which write the game's saves, so the
# player's user:// saves are backed up and restored byte for byte.
#
#   tools/build-art.sh
set -euo pipefail

SITE="$(cd "$(dirname "$0")/.." && pwd)"
GAME="$(cd "$SITE/../bounce-court" && pwd)"
SAVES="$HOME/.local/share/godot/app_userdata/Bounce Court"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# --- Capture, with the saves backed up ---------------------------------------
mkdir -p "$TMP/saves" "$TMP/raw"
for f in bc_save.cfg bc_achievements.cfg; do
	[ -f "$SAVES/$f" ] && cp -p "$SAVES/$f" "$TMP/saves/$f"
done
restore() {
	for f in bc_save.cfg bc_achievements.cfg; do
		if [ -f "$TMP/saves/$f" ]; then cp -p "$TMP/saves/$f" "$SAVES/$f"
		elif [ -f "$SAVES/$f" ]; then rm -f "$SAVES/$f"; fi   # made by the capture
	done
}
trap 'restore; rm -rf "$TMP"' EXIT
# --disable-vsync: a capture window hidden behind others gets no frames from
# the compositor and would stall (playbook §14).
godot --disable-vsync --path "$GAME" --resolution 720x1280 -s tools/site_art.gd -- "$TMP/raw" \
	| grep -E '\.png|capsules' || true

# --- Convert -------------------------------------------------------------------
mkdir -p "$SITE/img/shots" "$SITE/img/capsules" "$SITE/img/trophies" "$SITE/img/perks" "$SITE/img/formations" "$SITE/fonts"
for f in "$TMP"/raw/theme_*.png; do
	id="$(basename "$f" .png)"; id="${id#theme_}"
	magick "$f" -resize 360x640 -strip -quality 82 "$SITE/img/shots/$id.webp"
done
magick "$TMP/raw/theme_bubble_pop.png" -resize 540x960 -strip -quality 85 "$SITE/img/shots/hero.webp"
magick "$TMP/raw/powerups.png" -resize 360x640 -strip -quality 82 "$SITE/img/shots/powerups.webp"
magick "$TMP/raw/tutorial.png" -resize 360x640 -strip -quality 82 "$SITE/img/shots/tutorial.webp"
magick "$TMP/raw/perks.png" -resize 360x640 -strip -quality 82 "$SITE/img/shots/perks.webp"
magick "$TMP/raw/stages.png" -resize 360x640 -strip -quality 82 "$SITE/img/shots/stages.webp"
# The arena only: centred at 47% of the 1280 px height (run.gd), 303 px out
# to the rim's edge.
for f in "$TMP"/raw/formation_*.png; do
	n="$(basename "$f" .png)"; n="${n#formation_}"
	magick "$f" -crop 620x620+50+292 +repage -resize 240x240 -strip -quality 82 "$SITE/img/formations/$n.webp"
done
for f in "$TMP"/raw/perk_*.png; do
	k="$(basename "$f" .png)"; k="${k#perk_}"
	magick "$f" -trim +repage -strip "$SITE/img/perks/$k.png"
done
for f in "$TMP"/raw/capsule_*.png; do
	k="$(basename "$f" .png)"; k="${k#capsule_}"
	magick "$f" -trim +repage -strip "$SITE/img/capsules/$k.png"
done
for f in "$GAME"/assets/ui/trophies/*.png; do
	magick "$f" -strip -quality 85 "$SITE/img/trophies/$(basename "$f" .png).webp"
done

# Icon: the game's launcher icon (tools/render_icon.py in the game).
ICON="$GAME/assets/icon/icon_1024.png"
magick "$ICON" -resize 512x512 -strip "$SITE/img/icon.png"
magick "$ICON" -resize 180x180 -strip "$SITE/apple-touch-icon.png"
magick "$ICON" -resize 64x64 -strip "$SITE/favicon.png"

cp "$GAME/assets/fonts/kenney_pixel.ttf" "$SITE/fonts/kenney_pixel.ttf"
echo "site art built"
