# Ulalek Calculator

A small installable web app for one question at the Commander table: with
**Ulalek, Fused Atrocity** on the battlefield and a spell just cast, how many
copies can I make with the colorless mana I have, and in what order do I have
to do things to get them?

Live: https://aurelio-amerio.github.io/ulalek-calculator/

## Using it

1. Enter the **colorless mana** you have left after paying for everything:
   the main spell, any Eldrazi spell you cast in response, and any copier
   activation (Abstruse Archaic, Strionic Resonator, Peter Parker's Camera).
   The app never deducts costs itself.
2. Set the two main-spell switches. Most Eldrazi spells are both Eldrazi and
   colorless. Turn "Eldrazi" off for something like Mystic Forge, which only
   triggers Ulalek if you cast an Eldrazi spell in response.
3. Set what is on the battlefield: Echoes of Eternity, Roaming Throne
   (naming Eldrazi), Delney, and which copiers you will activate.
4. Set how many Eldrazi spells you cast in response (Eldritch Immunity,
   Nameless Inversion, Dimensional Infiltrator all count as one each).
5. Tap the result bar at the bottom to expand the line of play and the
   breakdown.

The copy count assumes you spend all colorless mana on Ulalek's trigger and
ignores mana produced by the copies themselves; anything that makes mana
inside the loop is infinite anyway.

The rules model and the reasoning behind the line of play are in
`docs/superpowers/specs/2026-09-26-ulalek-calculator-design.md`.

## Install on Android

Open the live link in Chrome, open the browser menu and choose **Add to Home
screen** (or **Install app**). It works offline afterwards and updates itself
when a new version is deployed.

## Development

Requires Node 22.12 or newer.

```sh
npm install
npm run dev        # http://localhost:5173/ulalek-calculator/
npm test           # engine, simulator and UI tests
npm run build      # type-check and build to dist/
npm run preview    # serve dist/ locally
npm run icons      # regenerate public/icons/*.png
```

`npm run dev` listens on all interfaces, so a phone on the same Wi-Fi can
open `http://<your-pc-ip>:5173/ulalek-calculator/` to try changes before
deploying. Installing as an app from that address is not possible because it
is not HTTPS; use the live link for that.

## Deployment

Every push to `main` runs the tests, builds the site and deploys it to GitHub
Pages through `.github/workflows/deploy.yml`. Pull requests run the tests and
build without deploying. Pages must be enabled once in the repository
settings (Settings → Pages → Source: GitHub Actions) before the Live link
works.

## Adding a card

Card data lives in `src/engine/cards.ts`.

- A permanent that makes triggered abilities "trigger an additional time"
  goes in `STATIC_DOUBLERS`. `affects` lists the tags a permanent needs for
  the doubler to apply to it. `copiesSpell` is set only if the card also
  copies spells you cast, like Echoes. Ulalek's own tags are in
  `ULALEK_TAGS`.
- A "copy target ability" activation goes in `ACTIVATED_COPIERS` with its
  cost as text. Copier roles are assigned uniformly by `affectsSourceTags`,
  so a copier with narrower real-world exceptions needs engine and simulator
  review, not just a data entry.

Add a test for the new card in `tests/multiplicity.test.ts` or
`tests/calculate.test.ts`. The grid test in `tests/simulator.test.ts` checks
that the closed-form result still matches the stack simulator.
