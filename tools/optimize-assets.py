# -*- coding: utf-8 -*-
"""
Re-runnable image optimizer for the Maylaa site.

Run this any time you add or swap images:

    python tools/optimize-assets.py            # report only, changes nothing
    python tools/optimize-assets.py --apply    # actually rewrite the files

What it does, to every image referenced from the HTML:
  * downscales anything whose longest edge is bigger than MAX_EDGE
  * re-encodes photographic PNGs (no transparency) as JPEG, and rewrites the
    references in the HTML, because a 3 MB photo-as-PNG is ~25x a JPEG
  * strips metadata and re-encodes at a sane quality

It never touches SVGs, never upscales, and skips any file it cannot improve.
Originals stay in git history, so a bad run is one `git checkout` away.
"""
import argparse
import io
import os
import re
import sys
import glob

try:
    from PIL import Image
except ImportError:
    sys.exit("Pillow is required:  pip install Pillow")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAX_EDGE = 1600          # nothing on this site is displayed wider than this
JPEG_QUALITY = 82
PNG_TO_JPEG_MIN = 300_000  # only bother converting PNGs above this size
SKIP_DIRS = ("images/brands/",)  # logos are already small + need transparency

PAGES = [p for p in glob.glob(os.path.join(ROOT, "*.html"))
         if os.path.basename(p) != "index0.html"]


def referenced_images():
    """Every image the site actually loads, from src/href and CSS url()."""
    found = set()
    for page in PAGES:
        h = io.open(page, encoding="utf-8").read()
        found |= set(re.findall(r'(?:src|href)="(images/[^"]+)"', h))
        found |= {u.strip('\'"') for u in re.findall(r'url\(([^)]+)\)', h)
                  if u.strip('\'"').startswith("images/")}
    return {f for f in found if not f.lower().endswith(".svg")}


def has_alpha(im):
    if im.mode in ("RGBA", "LA", "PA"):
        extrema = im.convert("RGBA").getchannel("A").getextrema()
        return extrema[0] < 255
    return "transparency" in im.info


def optimize(rel, apply_changes):
    """Returns (before, after, note, new_rel_or_None)."""
    path = os.path.join(ROOT, rel)
    if not os.path.exists(path):
        return None
    before = os.path.getsize(path)

    try:
        im = Image.open(path)
        im.load()
    except Exception as e:
        return (before, before, f"unreadable ({e})", None)

    w, h = im.size
    notes = []

    # 1. downscale
    if max(w, h) > MAX_EDGE:
        scale = MAX_EDGE / max(w, h)
        im = im.resize((max(1, round(w * scale)), max(1, round(h * scale))), Image.LANCZOS)
        notes.append(f"{w}x{h}->{im.size[0]}x{im.size[1]}")

    # 2. photographic PNG -> JPEG (only when nothing depends on transparency)
    ext = os.path.splitext(rel)[1].lower()
    new_rel = None
    if ext == ".png" and before >= PNG_TO_JPEG_MIN and not has_alpha(im):
        new_rel = os.path.splitext(rel)[0] + ".jpg"
        target = os.path.join(ROOT, new_rel)
        fmt, params = "JPEG", dict(quality=JPEG_QUALITY, optimize=True, progressive=True)
        im = im.convert("RGB")
        notes.append("png->jpg")
    else:
        target = path
        if ext in (".jpg", ".jpeg"):
            fmt, params = "JPEG", dict(quality=JPEG_QUALITY, optimize=True, progressive=True)
            im = im.convert("RGB")
        elif ext == ".png":
            fmt, params = "PNG", dict(optimize=True)
        elif ext == ".webp":
            fmt, params = "WEBP", dict(quality=JPEG_QUALITY, method=6)
        else:
            return (before, before, "unsupported format", None)

    buf = io.BytesIO()
    im.save(buf, fmt, **params)
    after = buf.tell()

    # only keep the result if it is actually smaller
    if new_rel is None and after >= before:
        return (before, before, "already optimal", None)

    if apply_changes:
        with open(target, "wb") as fh:
            fh.write(buf.getvalue())
        if new_rel and os.path.abspath(target) != os.path.abspath(path):
            os.remove(path)

    return (before, after, ", ".join(notes) or "re-encoded", new_rel)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="write changes (default: dry run)")
    args = ap.parse_args()

    images = sorted(referenced_images())
    images = [i for i in images if not any(i.startswith(d) for d in SKIP_DIRS)]

    total_before = total_after = 0
    renames = {}
    rows = []

    for rel in images:
        res = optimize(rel, args.apply)
        if not res:
            continue
        before, after, note, new_rel = res
        total_before += before
        total_after += after
        if new_rel:
            renames[rel] = new_rel
        if before - after > 20_000 or new_rel:
            rows.append((before - after, before, after, rel, note))

    rows.sort(reverse=True)
    print(f"{'saved':>10} {'before':>10} {'after':>10}  file")
    for saved, before, after, rel, note in rows:
        print(f"{saved/1048576:9.2f}M {before/1048576:9.2f}M {after/1048576:9.2f}M  {rel}  [{note}]")

    print()
    print(f"  total before : {total_before/1048576:8.2f} MB")
    print(f"  total after  : {total_after/1048576:8.2f} MB")
    print(f"  saved        : {(total_before-total_after)/1048576:8.2f} MB "
          f"({100*(total_before-total_after)/max(total_before,1):.0f}%)")

    if renames:
        print(f"\n  {len(renames)} file(s) changed extension; rewriting HTML references:")
        for old, new in renames.items():
            print(f"    {old} -> {new}")
        if args.apply:
            for page in PAGES:
                h = io.open(page, encoding="utf-8").read()
                orig = h
                for old, new in renames.items():
                    h = h.replace(old, new)
                if h != orig:
                    io.open(page, "w", encoding="utf-8", newline="\n").write(h)
                    print(f"    updated {os.path.basename(page)}")

    if not args.apply:
        print("\n  DRY RUN - nothing written. Re-run with --apply to commit these changes.")


if __name__ == "__main__":
    main()
