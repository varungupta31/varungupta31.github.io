The site's cat uses the 64×64 pixel cats by Last tick:
https://last-tick.itch.io/animated-pixel-cats-64x64

Their licence allows use on this site but forbids redistributing the files, so the sprite sheets are
committed here only as `sprites.enc` (AES-256-GCM). `scripts/cat-assets.mjs` decrypts them into
`public/cat/` (git-ignored) before `npm run dev` and `npm run build`, using `CAT_ASSETS_KEY` from `.env`
locally or from the repository secret of the same name in GitHub Actions. Without the key the site
still builds; the cat just doesn't appear.

To replace the sheets: `node scripts/cat-assets.mjs pack "<extracted pack folder>"`.
