import { selectedGroups } from "./world-bindings.mjs";

// Mask images are extension data: DTCG has no image type. The ordinary colour
// roles still resolve through Terrazzo and follow the host page's mode.
export function crossingRules(resolver, world, tokens) {
  const masks = new Map();
  for (const group of selectedGroups(resolver, {
    world,
    mode: "light",
    output: "web",
  }))
    for (const [name, source] of Object.entries(group.crossing ?? {})) {
      const mask = source.$extensions?.["design-tokens.mask"];
      if (mask) masks.set(name, mask);
    }
  return Object.keys(resolver.source.modifiers.world.contexts)
    .filter((name) => name !== "neutral")
    .map((name) => {
      const mask = masks.get(name);
      if (
        !/^[a-z][a-z0-9-]*$/.test(name) ||
        !mask ||
        !["add", "intersect"].includes(mask.composite) ||
        !tokens[`color.crossing.${name}`] ||
        ["image", "size", "position", "composite"].some(
          (key) => typeof mask[key] !== "string" || !mask[key].trim(),
        )
      )
        throw new Error(`Incomplete destination mark: ${name}`);
      // Additive layers paint directly so an inline pseudo-element keeps its
      // underline and fragment bounds. Intersecting layers need the mask stage.
      const paint = mask.image.replaceAll("#000", "var(--crossing-ink)");
      const intersect = mask.composite === "intersect";
      return `a[data-gazette-destination-theme="theme:${name}"]:is([data-gazette-destination-kind="cross-site"],[data-gazette-destination-kind="internal-native"]), .world-mark[data-world-mark="${name}"] {
  --crossing-target-ink: var(--color-crossing-${name});
  --link-mark-image: ${intersect ? "linear-gradient(var(--crossing-ink),var(--crossing-ink))" : paint};
  --link-mark-size: ${intersect ? "var(--space-3) var(--space-3)" : mask.size};
  --link-mark-position: ${intersect ? "right center" : mask.position};
  --link-mark-mask: ${intersect ? paint : "none"};
  --link-mark-mask-size: ${mask.size};
  --link-mark-mask-position: ${mask.position};
  --link-mark-composite: ${mask.composite};
}`;
    })
    .join("\n");
}
