import { readFileSync } from "node:fs";
import { compareWorlds } from "./world-matrix.mjs";

const matrix = JSON.parse(
  readFileSync(new URL("../dist/worlds.json", import.meta.url), "utf8"),
);
const collisions = compareWorlds(matrix).filter(
  (item) => !item.differingAxes.length,
);
if (collisions.length) {
  for (const item of collisions)
    console.error(
      `${item.worlds.join(" / ")}: identical non-colour token positions in ${item.mode}, ${item.motion} motion`,
    );
  process.exitCode = 1;
} else
  console.log(
    "All declared worlds differ beyond colour in each token state; rendered distinctness still needs visual review.",
  );
