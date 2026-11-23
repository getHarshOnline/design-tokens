# AGENTS.md: design-tokens

The only home of design token values: shared physics, one file per world, two colour modes and the reduced form of every motion. Gazette themes consume the built output; none of them restate values.

## Before changing anything

Start with [the token map and design guidance](README.md#design-guidance) and [the seven writing rules](README.md#writing-tokens). Find the role in the resolver and in the world, mode and output that consume it. Keep shared physics in the shared token sets. Keep world values with their world and derive the reduced-motion form in the existing motion roles.

Use the [build and consumer checks](README.md#consumer-capture-verification) for the outputs the change reaches. Check the resolved role as well as the generated files. For a change to appearance or interaction, inspect the consuming theme in the relevant modes and states.

A token change reaches every consumer of its role. Shared physics and the colour modes reach the six world themes (Carrier, Chassis, Chronicle, Folio, Lattice and Nocturne) through `dist/css/<world>.css`, and Base's neutral fixture through `dist/css/base.css`. A value in one world's file reaches that world's theme alone, and its enclave stylesheets, which no theme selects yet. Check the themes the change reaches, not only the generated files.

## Repository facts

- `dist/` is generated and never edited or committed; remove it before a build that is verified.
- Build: `nvm use && npm install && npm run build`; `.nvmrc` names the Node version (22 or later is required), and a version manager reads it only when asked.
- Keep lasting design reasons beside their roles in [README.md](README.md); routine changes and checks belong to Git and review evidence. Approval retains its owner's scope and source.
- Git: work in this repository. The composing workspace chooses what renders.
