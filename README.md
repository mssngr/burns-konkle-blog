# Baby Burns-Konkle shower registry

Astro site deployed to GitHub Pages (burns-konkle.com) on every push to `main`.

- **Registry items:** `src/data/registry.ts`. Edit names/options there; a claim is keyed by item id + option name, so renaming an option orphans its claims.
- **Shared claims:** stored in a [Pantry](https://getpantry.cloud) basket (`registry` in production, `registry-dev` under `bun dev`). Config in `src/config.ts`.
- **Family view:** add `?family` to the URL to see names of guests who chose to stay anonymous.

```sh
bun install
bun dev      # http://localhost:4321
bun run build
```
