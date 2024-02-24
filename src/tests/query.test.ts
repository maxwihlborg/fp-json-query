import { describe, it, assert } from "vitest";
import * as query from "../query";

describe("query", () => {
  it.each([
    // op precedance
    [`c(2 + 2)`, 4],
    [`c(2 * 2)`, 4],
    [`c(2 * 2 + 3)`, 7],
    [`c(2 *(2 + 3))`, 10],
    [`c(2 / 2)`, 1],
    [`c(2 / 2 - 2)`, -1],
    [`c(2 - 2/2)`, 1],
    [`c(3*1/3)`, 1],
    [`c((1/2) * 2)`, 1], // TODO should work without parans

    // lt/lte
    [`c(1 < 2)`, 1],
    [`c(2 < 1)`, 0],
    [`c(2 < 3)`, 1],
    [`c(1 < 3)`, 1],
    [`c(1 <= 3)`, 1],
    [`c(3 <= 3)`, 1],
    [`c(4 <= 3)`, 0],

    // gt/gte
    [`c(1 > 3)`, 0],
    [`c(3 > 1)`, 1],
    [`c(2 > 1)`, 1],
    [`c(1 >= 2)`, 0],
    [`c(2 >= 2)`, 1],
    [`c(3 >= 2)`, 1],
  ])('query "%s" => %i', (q, expeced) => {
    assert.strictEqual(query.compile(q)([]), expeced);
  });
});
