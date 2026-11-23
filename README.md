# design-tokens

The single home of design token values: shared physics, one token file per world, two modes. Format: [DTCG 2025.10](https://www.designtokens.org/tr/2025.10/format/) with the [Resolver module](https://www.designtokens.org/tr/2025.10/resolver/). Build: [Terrazzo](https://terrazzo.app).

## Name and place

The name carries no `gazette-` prefix because the tokens belong to no single consumer. The prefix marks a repository the Gazette engine composes as a theme package; these values sit upstream of every target: the Gazette themes consume captured build output in local rendering; later targets, such as component libraries, consume the same build. Each consuming workspace binds the token output it uses. Custom token metadata uses the `design-tokens.*` namespace; `unit` and `pattern` guide interpretation, while `delivery` and `mark` retain their authored metadata.

Shared role meanings, physics, world identity and colour mode resolve together so a theme or film does not maintain another palette, type scale or motion table. World values alias a shared role when the design choice is shared; a distinct value needs a distinct reason. The neutral fixture has its own binding so it cannot silently borrow a publication’s identity.

## Design guidance

In a Pale checkout, open `packages/design/INDEX.md` for Pale Design (`pale.design`). Use `packages/design/system.md` to plan a role change and `packages/design/system/tokens.md` to trace its value. Use `packages/design/system/presentations.md` to work through mode, input and motion preferences. The world theme's `WORLD.md` supplies its brief. This repository owns the values and their build.

## Writing tokens

1. **Name the role.** Use what a value does, such as `accent` or `duration.feedback`, rather than its colour or size. Establish that meaning before adding the token.
2. **Keep the world roles complete.** Every world and the neutral binding define the same `world.*` ids. Alias a shared role when the world intentionally inherits that decision; equal numbers alone do not establish inheritance. Keep each world's structured pattern and unit metadata with its meaning. `tokens/world.roles.json` describes every shared world role; each world file describes why its own value fits.
3. **Design every state.** A colour role has a light and a dark form in each world. Motion has its designed reduced form, including the world's expressive counterpart. Check light and dark with both motion preferences; [motion](#motion) distinguishes transition values from waits and playback gates.
4. **Use the format's types and units.** Dimensions use `px` or `rem`; durations use `ms` or `s`. Other supported units and numeric axis coordinates follow [units and enumerations](#units-and-enumerations). Preserve the difference between a length and a coefficient so the consumer converts it once.
5. **Build the output.** Edit token sources and their producer, then regenerate `dist/`. Media and container queries use the generated literal layout values described under [consuming](#consuming), rather than custom properties or copied numbers.
6. **Check the consumers of a changed value.** Trace its aliases and derived outputs, then follow [consumer capture verification](#consumer-capture-verification) through the six implemented sites and any affected neutral fixture or film composition. Compare the affected states with the accepted design. A source or build check establishes only what it exercises.
7. **Describe the role once, then the choice.** Shared world-role meanings live in `tokens/world.roles.json`; a world’s `$description` explains its value choice. Other tokens keep their meaning beside their value. Keep lasting design reasons beside their owning roles here; changes, sources, verification and approval belong in Git history and review evidence. Repeated history in a value file does not explain its current use.

Article prose and its responsive column use `layout.reading-measure`; encounter introductions use `layout.encounter.copy-measure`. Their `em` values match 62 and 34 zero advances of the reading face, Instrument Sans (666 units per 1,000), keeping the accepted widths while a fallback font loads. The generic `layout.measure` stays in `ch` for consumers whose width follows their own face, including display headings. Recheck the reading measures if the reading face changes.

The reading family's `design-tokens.web-fallback` metadata emits local fallback faces into each web stylesheet. Upright Arial/Liberation Sans uses measured advance adjustments for regular and bold text, with Instrument Sans's ascent and descent divided by the adjustment. This reduces reflow during delayed loading without changing the delivered typeface. The correction was checked with Arial on macOS; other platforms retain the ordered family stack and need their own rendered check. Font declarations and file delivery remain with the theme.

## Structure

| Path | Contents |
| --- | --- |
| `resolver.json` | `physics` → `world-roles` → `world` → `mode` → `output`; the default output is web. The neutral world context includes its separate scene values for Base fixtures |
| `tokens/physics/layout.tokens.json` | space and spacing roles with their fluid pairs, field, margins, columns, measure, shell and preview widths, fluid range, breakpoints (the compact one also the space side of the context), container thresholds (including the side-rail wrap), auto-fit track minimum, bookmark capacity bounds and artwork aspect, sticky chrome, intrinsic block estimate, test widths, targets, focus, strokes, radius, elevation (shell, plate, popover), island cost bounds (pixel-ratio cap, lazy-start margin) |
| `tokens/physics/type.tokens.json` | role families (display default, reading, system, code, numeric), weights, scale with the fluid display step, line-heights, tracking, optical-size ratio, ink floors |
| `tokens/physics/motion.tokens.json` | productive durations (including the destructive hold), easing (productive, and move for on-screen movement), press and entry scale, productive blur and spring; base expressive duration; preview delay, preview warm window and productive stagger step; productive reduced forms, optional scene responses and the base of an expressive moment without travel |
| `tokens/physics/material.tokens.json` | material registers (stock, emulsion, anodised, phosphor), floating-layer fill, and light (the default key colour per mode and angle, edge, emission strength and spread, halation) |
| `tokens/physics/amplitude.tokens.json` | amplitude levels 0–4 as permission ceilings |
| `tokens/physics/crossing.tokens.json` | every world's crossing colours, light and dark, and destination mask geometry |
| `tokens/world.roles.json` | Shared meanings and retained bounds for every world role, without values. A missing numeric limit stays unspecified; the build checks that each neutral value and pattern role has a description |
| `tokens/worlds/<world>.tokens.json` | colour roles (`world.light.*`, `world.dark.*`) and eight token groups carrying the nine motif axes from the world theme's `WORLD.md`: `world.type`, `world.material` (including the raster), `world.geometry` (including the world's own `plate-edge`), `world.figure`, `world.illumination` (including the key, which aliases `color.key`, and its angle), `world.crop`, `world.depth`, `world.motion` (including emission decay and `world.motion.reduced`, the expressive motion without travel); `world.type` also carries the system-voice case |
| `tokens/modes/<mode>.tokens.json` | binds `color.*`, `color.key`, `color.shadow` and `color.crossing.<world>` to the active mode, and sets the mode's colour-state derivations (`color.state.*`) and lift strengths (`color.lift.*`) |
| `tokens/base/neutral.tokens.json` | the neutral world binding: achromatic colour roles and every motif axis at its shared default, with the same `world.*` ids as every world |
| `terrazzo.config.mjs` | One build for world and neutral CSS, enclave CSS (stylesheets that let a region of one world's page render in another world's tokens; no theme selects them yet), SCSS and film outputs. Worlds come from the resolver; each world's `world.mode.default` pattern metadata chooses a system-following or dark fresh visit |
| `tokens/outputs/frame.tokens.json` | frame-only canvas profiles, safe fields, type sizes and timing defaults |
| `scripts/world-matrix.mjs` | Build plugin for the joint nine-axis view in `dist/worlds.json` and `dist/worlds.md`, across light/dark and full/reduced motion |
| `scripts/frame-output.mjs` | Build plugin for resolved `dist/frame/<world>-<mode>.json` for film authoring |
| `scripts/explain.mjs` | Explains a selected token or pattern with its resolved value, source files, aliases and authored descriptions |
| `scripts/token-css.mjs` | shared CSS pieces: units, springs, pattern properties, colour-mode and motion-preference blocks |
| `scripts/scss-literals.mjs` | Build plugin for `dist/scss/_layout.scss`, every resolved `layout.*` dimension as a literal SCSS variable |
| `scripts/styles-output.mjs` | Suppresses token descriptions before the CSS plugin prints declarations; built CSS and SCSS carry values without altering comment-like text inside a value |
| `scripts/world-bindings.mjs` | Checks every world's role set against neutral and reads pattern metadata from the resolver's selected groups |

## Colour roles

Reading, controls, analytical figures and expressive scenes have different jobs. Functional contours and optical materials must not round an analytical cell or turn prose into scenery. Held state uses one emission hue per mode, distinct from an accent, status message or illustration. Optical defaults belong to the shared material plane; a film is one of its consumers.

The [shared world-role definitions](tokens/world.roles.json) describe paper, sheet, ink, contours, accent, held state, critical state, metal, focus and key light in both modes. `npm run explain -- color.paper --world carrier --mode dark` follows the mode binding to its shared meaning and the selected world’s value. The additional mode roles connect those values as follows.

| Role | Meaning |
| --- | --- |
| `color.crossing.<world>` | the signature that marks a link into another world |
| `color.shadow` | the cast-shadow colour: the mode's deepest role (ink in light, metal in dark), so a shadow takes its ground's tint; every elevation step, the shell included, sets its opacity |
| `color.lift.*` | a lifted surface's depth per mode: `shadow` multiplies each elevation step's opacity (full in light, weaker in dark), `edge` is the opacity of `color.key` along the key-facing edge (none in light, where the cast carries the lift; a lit edge in dark, where tone and light carry it) |
| `color.state.*` | hover, pressed and selected derivations: the fraction of `ink` a base role mixes in OKLab, set per mode, the same relation in every world |

Every world has its own palette in both modes; dark is designed per world, never shared. Every world also has its own key light in each mode (the `key` role and `world.illumination.key-angle`); the physics key (`illumination.key.light`, `illumination.key.dark`, `illumination.key-angle`) is the default the neutral base aliases.

## Units and enumerations

- Quantities DTCG cannot type (ch, em, deg, seconds, variable-axis values) are `number` tokens naming their unit in `$extensions["design-tokens.unit"]`; the CSS output appends ch, em, deg and s. Axis coordinates (`wdth`) and `em-ratio` coefficients remain bare numbers. A consumer multiplies an `em-ratio` by its font size exactly once; it is not an already dimensional length.
- Destination masks use `$extensions["design-tokens.mask"]` beside each `crossing.<world>` signature because DTCG has no image type. `image` contains CSS gradient layers using opaque `#000` and `transparent`; `size`, `position` and `composite` (`add` or `intersect`) retain their geometry. The build tints additive layers for direct inline painting, preserving underlines and fragment bounds; intersecting layers use a mask. The descriptive `design-tokens.mark` glyph is not a font requirement. Every named world needs a mask and mode-bound crossing colours; generated selectors bind Gazette’s destination identity to Base’s one link recipe.
- Enumerated choices (raster pattern, geometry shape language, plate edge, caption placement, bleed permission, system-voice case) name their value in `$extensions["design-tokens.pattern"]` on the token or group they qualify. `world.crop.bleed` uses the scale contained · peak-only · named-plates · free (0–3). It narrows amplitude level 4.
- The build emits each world's pattern choices as string custom properties named after the group or token they qualify, in the world stylesheet and in its enclave block: `--world-material-raster-pattern`, `--world-geometry-pattern`, `--world-geometry-plate-edge-pattern`, `--world-figure-caption-pattern`, `--world-crop-bleed-pattern` and `--world-type-system-case-pattern` (for example `--world-geometry-plate-edge-pattern: bracket-cut;`, `--world-type-system-case-pattern: uppercase;`, which is the system labels' `text-transform`). A world stylesheet selects its recipe by its own world; the property documents and verifies the choice.

## Motion

Shared response values leave each consumer in charge of its clock and interruption behavior. Scroll, pointer, ambient and linear-film time are not interchangeable. Reading intervals and other waits use `delay`, separate from transition `duration`; scene coordinates, edits and frame counts stay with the source composition.

Productive motion is one duration set, one cubic-bezier easing and one spring; movement between two on-screen positions takes `easing.move`, a press scales to `scale.press`, a surface enters from `scale.enter` and a crossfade passes through `blur.productive`. Each world adds an expressive scale, easing, spring and emission decay. Time-valued gaze, field and film-response parameters use duration tokens; their consumers convert explicitly to the milliseconds or seconds their controllers use. The opt-in primary-action response has its own shared motion role, separate from film playback and from supporting-card choreography.

The build emits each spring twice from the same parameters: as `visual-duration` and `bounce` for Motion islands, and as a CSS `linear()` easing with its computed duration (`--motion-spring-productive-easing`, `--world-motion-expressive-spring-easing` and their `-duration`) for stylesheets, using Motion's spring function at build time. Bookmark and film-navigation curves also read the selected world's resolved parameters, including aliases, rather than reading the shared source file directly.

The film-navigation easing derives from [Lenis](https://github.com/darkroomengineering/lenis/tree/v1.3.11); its MIT notice is retained in [NOTICE](NOTICE).

`delay.process-step` is the reading interval for opt-in process autoplay; reduced motion disables that autoplay in the consumer. Hover intent and warm windows keep their ordinary `delay.*` values because waiting is not spatial motion. `delay.stagger` is the productive stagger step; an expressive stagger is that step multiplied by `world.motion.expressive-scale`.

Productive roles, including the stagger, use their designed reduced forms in `motion.reduced.*`: no spatial travel, with state carried by opacity, light and tone on `motion.reduced.easing`.

Optional character, film, field and typing enhancements expose their complete native composition when motion is reduced; their lifecycle gates replace unused zero-valued timing copies. `motion.typing-reveal.duration` times a typed premise independently of the destructive confirmation hold.

Each world's expressive motion has its own reduced form in `world.motion.reduced` (scale of `motion.reduced.expressive`, easing and decay): the world's time without travel, never zero.

Website CSS binds eight consumer roles in each root and enclave: expressive duration, easing and decay; preview selection duration, artwork duration, scale and lift; and deck-body fade duration. The emitted `--expressive-*`, `--preview-*` and `--deck-body-duration` properties select their reduced inputs for `data-motion="reduce"` or a reduced system preference without `data-motion="allow"`. Explicit Full keeps ordinary values; absent or System follows the device. Enclaves resolve these aliases against their own world values. Components retain their static compositions and playback gates; raw duration and scale tokens keep their meanings for other consumers.

## Consuming

Frame production is part of `npm run build`; `npm run build:frames` invokes that same build. The explicit `output: frame` context adds film roles to the same world and colour-mode resolution. Those roles are absent from website CSS and SCSS. Each `design-tokens.frame.v1` output carries the native theme variables, resolved fonts, output profiles and `sourceInputs` hashes. Its structured `expression` preserves material, raster, geometry, depth, emission, type, motion, crop and figure roles. `adaptation` derives spatial and motion scales from the existing reading, frame-type and transition roles; source values remain available alongside explicit frame aliases. The default expressive duration multiplies the film transition by the world’s relative pace; emission decay applies the same motion scale to the world’s release. Actual shot timing belongs to the edit. Chitra, the one image and film engine that Sleepwalker, Rêve and getHarsh share, has a frame-composition tool that uses that output and the project brief to prepare `frame.md`.

HyperFrames renders the film; the project owns the story, claims, source media and selected delivery. A fixed-pixel film needs an intentional colour rendition because its output cannot follow a webpage’s colour-mode change. Film scales adapt dimensions and relative pace without replacing the source roles or prescribing a shot’s duration.

Frame files carry typed values and their freshness inventory; source explanations stay with the producer. From the bound producer’s checkout, ask for the exact world, mode and output in use:

```bash
npm run explain -- world.illumination.key --world lattice --mode dark --output frame
```

The command returns the resolved value and description, then the authored source layers and complete effective alias chain with repository-relative files. Source layers stay in resolution order, including inherited metadata and partial overrides; the top-level fields show their merged result. For a world role, the shared definition and the world’s particular reason remain separate source layers, so an override never hides the role’s meaning. It also explains pattern metadata such as `world.mode.default`; unknown names or contexts fail explicitly. Omitted selections use `resolver.json` defaults. Run it in the producer bound by the consuming workspace so the explanation describes the same installation as the generated file.

`npm run check:frames` checks the generated outputs and their source inventory. Changing a token without rebuilding makes the frame handoff stale. Scene timing, subject coordinates and product claims remain in their composition and source records; they do not become shared token values.

Gazette themes currently capture the built CSS and SCSS for local rendering. A tagged token release remains a separate delivery step; downstream consumers do not author their own values. The colour-mode blocks key on `data-mode`, and the enclave scopes on `data-world`. See the `gazette-theme-base` repository's `docs/attributes.md` for current writers and unbuilt attributes, and its `AGENTS.md` for the shared theme contract.

Media and container queries cannot read custom properties, so `@media` and `@container` conditions use the literal SCSS variables in the separate partial `dist/scss/_layout.scss` (`$layout-breakpoint-compact`, `$layout-container-rail`, `$layout-test-width-phone: 390px;`, the field, margins, fluid range, shell and preview widths). The breakpoints and container thresholds are where layouts recompose; the test widths are verification widths, never breakpoints. `$layout-breakpoint-compact` is also the space side of a placed region's context: below it the region resolves as mobile. At and above it, the pointer and hover media features decide.

`dist/css/base.css` binds physics and the colour-mode roles to the neutral world (`tokens/base/neutral.tokens.json`) for base-theme fixtures only. It is never shipped by a world: a world theme loads `dist/css/<world>.css`, and the neutral binding never appears on a published page.

`dist/css/enclaves.css` is groundwork for hosts whose default follows the system; `dist/css/enclaves-dark.css` is the equivalent for hosts whose absent-mode default is dark. Select exactly one from the host's mode policy, never from the enclave's target world. Both honor explicit light, dark and system choices. No current theme selects these files. The stylesheet scopes every world's colour roles and `world.*` tokens under `[data-world="<world>"]`, so a region of one world's page can render in another world while physics and colour mode stay the page's: its dark blocks rebind the region's colour roles, so it carries its own world's key and shadow in the page's current mode. A future template would place an enclave from a structured destination's supplied theme; a link inside body text is never an enclave and takes the page's own `color.crossing.<world>` instead. See **Resolved body-link attributes** in Gazette's `docs/theme-reference.md` for the engine-supplied link data.

```bash
nvm use         # the Node version .nvmrc names (22 or later is required)
npm install
npm run build
```

Token sources describe values and meaning; the relevant sections above explain the lasting choices. Owner approval and verification keep their own scoped evidence.

## Comparing worlds

`npm run build` generates `dist/worlds.md` and its complete typed data in `dist/worlds.json`. Every named world comes from the resolver, on the nine axes in the same order as the world briefs. Neutral remains a fixture binding. The view uses the web context in light and dark; full and reduced motion show their own expressive roles, with the reduced easing replacing the full expressive spring. Emission decay follows the same selected motion form.

Read the table beside each world’s `WORLD.md`: it compares declared positions, including treatments that are not yet drawn. `npm run check:worlds` reads the generated data and flags any pair whose non-colour positions are identical in a state. Different values or pattern names establish a source difference, not a visually distinct treatment. The rendered comparison still uses equivalent content, suppressed accent, quiet reading and opened controls in all four states. Keep that visual finding with the existing design review; do not turn a count of differing axes into an approval score.

## Consumer capture verification

Run `npm run build` to resolve aliases and generate the web and frame outputs. `npm run check:frames` checks frame outputs against their source inventory. `npm run check:worlds` compares the generated world positions. `node --test scripts/*.test.mjs` adds resolver, joint-view and CSS checks. The enclave and motion tests need Playwright and a Chromium browser. If Playwright lives in another workspace, set `PLAYWRIGHT_MODULE` to the installed module; `PLAYWRIGHT_CHANNEL` can select an installed browser channel such as `chrome`.

Run `npm run check:captures` with the Gazette theme checkouts alongside this checkout. It compares their captured CSS and literal SCSS, including the input inventory digest, and rejects verification-width roles in production styles. Use `npm run capture` when you intend to refresh those copies. A composing workspace can also bind the generated `dist` files directly.

Captures remain derived output. Their source hashes and freshness checks prevent a standalone theme and a direct workspace binding from silently using different revisions. Editing a generated declaration is never a design change.

For an appearance or interaction change, use `tools/design-verification/README.md` in Pale for browser capture, then inspect the affected theme in the relevant states. For a palette change, check the affected foreground and background roles in both modes, including pairings that the rendered pages under review do not use.

Production navigation, columns and reading transitions have separate breakpoint roles. Verification widths describe test cases only. The neutral scene binding retains its established fixture values independently of world scene values; regeneration is not permission to change approved motion.

CSS and literal SCSS come from the same layout roles, so themes do not copy numbers into media queries. Consumers measure content size and source-asset registration where they are used rather than approximating them with global token constants.

## Licence

The tokens and their build are licensed under the MIT License with an attribution term: a site built with them keeps a footer credit stating that it was made using Gazette, such as "Made using Gazette", linking to [rawthoughts.in/gazette](https://rawthoughts.in/gazette/), and a link to this repository. [LICENSE](LICENSE) gives the full terms. The film-navigation easing derived from Lenis keeps its MIT licence in [NOTICE](NOTICE).
