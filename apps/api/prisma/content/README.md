# Starter content

`starter-content.json` is a sample import bundle: 17 tags, 6 destinations, 20 places, 1 sample package and 3 collections.

- All text is original. Facts are deliberately conservative: where we were not sure of a value (exact
  temperatures, entry fees, opening hours, most distances) it is left out rather than guessed.
- **Review before publishing.** Rishikesh and Jibhi were already live; their rows only enrich them.
  The other destinations, their places and two collections import as drafts.
- The package is titled **SAMPLE** and its prices are placeholders (₹1,000 / ₹2,000). Replace prices, hotels
  and policies with real ones before publishing it.
- No images are included. Add licensed images in Admin → Media and attach them in each editor.

```bash
cd apps/api && npm run build
npm run content:import -- prisma/content/starter-content.json          # dry run
npm run content:import -- prisma/content/starter-content.json --apply  # write
```

The same file can be pasted into Admin → Import.
