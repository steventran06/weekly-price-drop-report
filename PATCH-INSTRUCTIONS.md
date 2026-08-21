# Portland Home Guide Weekly Price-Drop Carousel

This patch adds a 7-slide, 1080x1350 Portland Home Guide carousel to the Wednesday price-drop workflow:

1. Cover
2. Highlighted home 1
3. Highlighted home 2
4. Highlighted home 3
5. Highlighted home 4
6. Highlighted home 5
7. Static PortlandHomeGuide.com CTA

The JPEGs are attached to the existing Wednesday report email. Carousel generation is non-blocking, so a render failure will not prevent the weekly report from continuing.

## Install

From the root of `weekly-price-drop-report`:

```bash
unzip -o ~/Downloads/price-drop-carousel-patch.zip -d .
npm run build
```

## Test without rerunning Gmail / OpenAI

If `output/weekly-analysis.json` and `output/listings.json` already exist:

```bash
npm run price-drops:carousel-preview
```

Generated files will appear under:

```text
output/price-drops/instagram/price-drops-YYYY-MM-DD/
```

Expected files:

```text
01-cover.jpg
02-home-1.jpg
03-home-2.jpg
04-home-3.jpg
05-home-4.jpg
06-home-5.jpg
07-cta.jpg
caption.txt
manifest.json
```

## Full Wednesday workflow test

```bash
npm run weekly
```

The report email should include the carousel JPEGs as attachments plus a Portland Home Guide carousel caption section.

## Notes

- Uses the existing Portland Home Guide logo and Instagram brand palette in `src/social/instagram/config.ts`.
- Property photos use the RMLS `imageUrl` already parsed for each selected listing.
- If a remote photo cannot be fetched, that slide uses a branded fallback instead of failing the weekly workflow.
- Image downloads are bounded to 15 MB and a 15-second timeout.
- This patch generates/email-attaches the price-drop carousel; it does not auto-publish it to Instagram.
