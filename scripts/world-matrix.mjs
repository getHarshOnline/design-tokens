import { isDeepStrictEqual } from "node:util";
import { resolvedTokens } from "./resolved-tokens.mjs";
import { selectedPatterns } from "./world-bindings.mjs";

const under = (id, group) => id === group || id.startsWith(group + ".");
const decay = (motion) =>
  motion === "reduced" ? "world.motion.reduced.decay" : "world.motion.decay";

// The nine axes from the world briefs, in their shared order. These selectors
// group resolved roles; they supply no world values or implementation claims.
const axes = [
  [
    "material",
    "Material character",
    (id) =>
      (under(id, "world.material") && !under(id, "world.material.raster")) ||
      /^color\.[^.]+$/.test(id),
  ],
  ["raster", "Raster and texture", (id) => under(id, "world.material.raster")],
  [
    "geometry",
    "Geometry",
    (id) =>
      under(id, "world.geometry") ||
      ["color.line", "color.strong-line"].includes(id),
  ],
  ["type", "Display inflection", (id) => under(id, "world.type")],
  ["figure", "Figure rhythm", (id) => under(id, "world.figure")],
  [
    "emission",
    "Emission hue and spectral light",
    (id, motion) =>
      under(id, "world.illumination") ||
      under(id, "illumination.halation") ||
      id === decay(motion),
  ],
  ["crop", "Crop behaviour", (id) => under(id, "world.crop")],
  [
    "depth",
    "Optical depth",
    (id) => under(id, "world.depth") || id === "illumination.edge",
  ],
  [
    "motion",
    "Expressive motion curve",
    (id, motion) =>
      motion === "reduced"
        ? under(id, "world.motion.reduced") ||
          id === "motion.reduced.expressive"
        : (under(id, "world.motion") && !under(id, "world.motion.reduced")) ||
          id === "duration.expressive",
  ],
];

function record(token) {
  return {
    type: token.$type,
    value: token.$value,
    ...(token.$extensions?.["design-tokens.unit"]
      ? { unit: token.$extensions["design-tokens.unit"] }
      : {}),
  };
}

export function buildWorldMatrix(resolver) {
  const worlds = Object.keys(resolver.source.modifiers.world.contexts).filter(
    (name) => name !== "neutral",
  );
  const states = [];
  for (const mode of ["light", "dark"]) {
    const selections = Object.fromEntries(
      worlds.map((world) => {
        const context = { world, mode, output: "web" };
        return [
          world,
          {
            tokens: resolvedTokens(resolver.apply(context)),
            patterns: selectedPatterns(resolver, context),
          },
        ];
      }),
    );
    for (const motion of ["full", "reduced"]) {
      states.push({
        mode,
        motion,
        worlds: Object.fromEntries(
          worlds.map((world) => {
            const { tokens, patterns } = selections[world];
            return [
              world,
              Object.fromEntries(
                axes.map(([id, , includes]) => [
                  id,
                  {
                    tokens: Object.fromEntries(
                      Object.keys(tokens)
                        .sort()
                        .filter((name) => includes(name, motion))
                        .map((name) => [name, record(tokens[name])]),
                    ),
                    patterns: Object.fromEntries(
                      [...patterns]
                        .filter(([name]) => includes(name, motion))
                        .sort(([a], [b]) => a.localeCompare(b)),
                    ),
                  },
                ]),
              ),
            ];
          }),
        ),
      });
    }
  }
  return {
    format: "design-tokens.world-matrix.v1",
    output: "web",
    axes: axes.map(([id, name]) => ({ id, name })),
    worlds,
    states,
  };
}

function nonColourPosition(axis) {
  return {
    tokens: Object.fromEntries(
      Object.entries(axis.tokens).filter(([, token]) => token.type !== "color"),
    ),
    patterns: axis.patterns,
  };
}

export function compareWorlds(matrix) {
  const comparisons = [];
  for (const state of matrix.states) {
    for (let i = 0; i < matrix.worlds.length; i++)
      for (let j = i + 1; j < matrix.worlds.length; j++) {
        const left = matrix.worlds[i],
          right = matrix.worlds[j];
        const differingAxes = matrix.axes
          .filter(
            ({ id }) =>
              !isDeepStrictEqual(
                nonColourPosition(state.worlds[left][id]),
                nonColourPosition(state.worlds[right][id]),
              ),
          )
          .map(({ id }) => id);
        comparisons.push({
          mode: state.mode,
          motion: state.motion,
          worlds: [left, right],
          differingAxes,
        });
      }
  }
  return comparisons;
}

const escape = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("|", "&#124;")
    .replaceAll("\n", " ");
const code = (value) => `<code>${escape(value)}</code>`;
function display(token) {
  const value = token.value;
  if (token.type === "color" && value.hex) return value.hex;
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    "value" in value &&
    "unit" in value
  )
    return `${value.value}${value.unit}`;
  return (
    (typeof value === "string" ? value : JSON.stringify(value)) +
    (token.unit ? ` ${token.unit}` : "")
  );
}

export function matrixMarkdown(matrix) {
  const lines = [
    "# World axes",
    "",
    "Generated from the resolver’s web context. These are declared positions, including roles whose treatments are not yet drawn. Each world’s `WORLD.md` distinguishes implementation from direction. [The JSON view](worlds.json) retains every typed value and unit; colour cells below show the supplied hex when available.",
    "",
    "Reduced rows use the declared reduced expressive roles; the reduced easing stands in for the full expressive spring. Source timing and recipe data do not establish the appearance of a rendered page. Compare equivalent captures with accent suppressed in all four states, including quiet reading and opened controls.",
    "",
    "Use `npm run explain -- <token> --world <world> --mode <mode> --output web` from the producer to read the selected sources and reasons.",
    "",
  ];
  for (const state of matrix.states) {
    lines.push(`## ${state.mode} · ${state.motion} motion`, "");
    for (const axis of matrix.axes) {
      lines.push(
        `### ${axis.name}`,
        "",
        `| Role | ${matrix.worlds.join(" | ")} |`,
        `| --- | ${matrix.worlds.map(() => "---").join(" | ")} |`,
      );
      for (const kind of ["tokens", "patterns"]) {
        const ids = [
          ...new Set(
            matrix.worlds.flatMap((world) =>
              Object.keys(state.worlds[world][axis.id][kind]),
            ),
          ),
        ].sort();
        for (const id of ids) {
          const values = matrix.worlds.map((world) => {
            const value = state.worlds[world][axis.id][kind][id];
            return value === undefined
              ? "—"
              : code(kind === "tokens" ? display(value) : value);
          });
          lines.push(
            `| ${code(id)}${kind === "patterns" ? " (pattern)" : ""} | ${values.join(" | ")} |`,
          );
        }
      }
      lines.push("");
    }
  }
  lines.push(
    "## Token comparison",
    "",
    "The automated check flags a pair with identical non-colour positions in any state. A different value or pattern name is only a source difference; it does not prove that people can distinguish the rendered worlds.",
    "",
  );
  const collisions = compareWorlds(matrix).filter(
    (item) => !item.differingAxes.length,
  );
  lines.push(
    ...(collisions.length
      ? collisions.map(
          (item) =>
            `- ${item.worlds.join(" / ")}: identical non-colour positions in ${item.mode}, ${item.motion} motion.`,
        )
      : [
          "No pair has identical non-colour token positions in these four states.",
        ]),
    "",
  );
  return lines.join("\n");
}

export default function worldMatrix() {
  return {
    name: "world-matrix",
    build({ resolver, outputFile }) {
      const matrix = buildWorldMatrix(resolver);
      outputFile("worlds.json", JSON.stringify(matrix, null, 2) + "\n");
      outputFile("worlds.md", matrixMarkdown(matrix));
    },
  };
}
