import { describe, it, assert, expect } from "vitest";
import * as query from "../query";

describe("query", () => {
  it.each([
    // op precedance
    [`2 + 2`, 4],
    [`2 * 2`, 4],
    [`2 * 2 + 3`, 7],
    [`2 * (2 + 3)`, 10],
    [`2 / 2`, 1],
    [`2 / 2 - 2`, -1],
    [`2 - 2/2`, 1],
    [`3*1/3`, 1],
    [`1/2 * 2`, 1],

    // lt/lte
    [`1 < 2`, 1],
    [`2 < 1`, 0],
    [`2 < 3`, 1],
    [`1 < 3`, 1],
    [`1 <= 3`, 1],
    [`3 <= 3`, 1],
    [`4 <= 3`, 0],

    // gt/gte
    [`1 > 3`, 0],
    [`3 > 1`, 1],
    [`2 > 1`, 1],
    [`1 >= 2`, 0],
    [`2 >= 2`, 1],
    [`3 >= 2`, 1],

    // unary precedence
    [`-1 + 2`, 1],
    [`-2 * 3`, -6],
    [`-(-1)`, 1],
    [`!1 || 1`, 1],
    [`!0 && 1`, 1],
    [`!0 || 0`, true],
    [`!!1`, true],
    [`!!0`, false],
    [`!!"hello"`, true],

    // and/or js-like
    [`1 && 2`, 2],
    [`0 && 2`, 0],
    [`1 || 2`, 1],
    [`0 || 2`, 2],

    // increment/decrement
    [`++5`, 6],
    [`--5`, 4],
    [`++0`, 1],
    [`--0`, -1],

    // modulo
    [`5 % 3`, 2],
    [`10 % 4`, 2],
    [`7 % 7`, 0],

    // ternary
    [`1 ? 2 : 3`, 2],
    [`0 ? 2 : 3`, 3],
  ])('"%s" => %i', (q, expeced) => {
    assert.strictEqual(query.compile(q)([]), expeced);
  });
});

describe("integration", () => {
  it("array literal creates iterable", () => {
    const input = { a: 1, b: 2 };
    const result = [...query.compile("[.a, .b]")(input)];
    expect(result).toEqual([1, 2]);
  });

  it("array literal with pipe to merge", () => {
    const input = { x: { a: 1 }, y: { b: 2 } };
    const result = query.compile("[.x, .y] | merge(.)")(input);
    expect(result).toEqual({ a: 1, b: 2 });
  });

  it("pipe in function args", () => {
    const input = { deps: { a: 1 }, devDeps: { b: 2 } };
    const result = query.compile("p(all, [.deps, .devDeps] | merge(.))")(input);
    expect(result).toEqual({ all: { a: 1, b: 2 } });
  });

  it("some returns boolean", () => {
    expect(query.compile("some(.a, .b)")({ a: 0, b: 0 })).toBe(false);
    expect(query.compile("some(.a, .b)")({ a: 0, b: 1 })).toBe(true);
    expect(query.compile("some(.a, .b)")({ a: 1, b: 0 })).toBe(true);
    expect(query.compile("some(.a, .b, .c)")({ a: 0, b: 0, c: 1 })).toBe(true);
  });

  it("every returns boolean", () => {
    expect(query.compile("every(.a, .b)")({ a: 1, b: 1 })).toBe(true);
    expect(query.compile("every(.a, .b)")({ a: 1, b: 0 })).toBe(false);
    expect(query.compile("every(.a, .b)")({ a: 0, b: 1 })).toBe(false);
    expect(query.compile("every(.a, .b, .c)")({ a: 1, b: 1, c: 1 })).toBe(true);
  });

  it("groupBy groups by key", () => {
    const input = [
      { type: "a", val: 1 },
      { type: "b", val: 2 },
      { type: "a", val: 3 },
    ];
    const result = query.compile("groupBy(.type)")(input);
    expect(result).toEqual({
      a: [
        { type: "a", val: 1 },
        { type: "a", val: 3 },
      ],
      b: [{ type: "b", val: 2 }],
    });
  });

  it("map with arithmetic", () => {
    const input = [{ x: 1 }, { x: 2 }, { x: 3 }];
    const result = [...query.compile("map(.x * 2)")(input)];
    expect(result).toEqual([2, 4, 6]);
  });

  it("filter with comparison", () => {
    const input = [{ x: 1 }, { x: 5 }, { x: 3 }];
    const result = [...query.compile("filter(.x > 2)")(input)];
    expect(result).toEqual([{ x: 5 }, { x: 3 }]);
  });

  it("chained pipes", () => {
    const input = [{ x: 1 }, { x: 5 }, { x: 3 }];
    const result = [...query.compile("filter(.x > 2) | map(.x)")(input)];
    expect(result).toEqual([5, 3]);
  });

  it("nested property access", () => {
    const input = { a: { b: { c: 42 } } };
    const result = query.compile(".a.b.c")(input);
    expect(result).toBe(42);
  });

  it("nullish property access returns undefined", () => {
    expect(query.compile(".a.b.c")({ a: null })).toBe(undefined);
    expect(query.compile(".a.b.c")({ a: undefined })).toBe(undefined);
    expect(query.compile(".a.b.c")({})).toBe(undefined);
    expect(query.compile(".x.y")({ x: { y: 0 } })).toBe(0);
  });

  it("or returns first truthy value", () => {
    expect(query.compile(".a || .b")({ a: null, b: 5 })).toBe(5);
    expect(query.compile(".a || .b")({ a: 0, b: 5 })).toBe(5);
    expect(query.compile(".a || .b")({ a: 3, b: 5 })).toBe(3);
    expect(query.compile(".a || .b || .c")({ a: null, b: null, c: 7 })).toBe(7);
    expect(query.compile(".a || .b || .c")({ a: null, b: 6, c: null })).toBe(6);
  });

  it("sum aggregation", () => {
    const input = [{ x: 1 }, { x: 2 }, { x: 3 }];
    const result = query.compile("sum(.x)")(input);
    expect(result).toBe(6);
  });

  it("count aggregation", () => {
    const input = [1, 2, 3, 4, 5];
    const result = query.compile("count()")(input);
    expect(result).toBe(5);
  });

  it("unique by key", () => {
    const input = [
      { id: 1, name: "a" },
      { id: 2, name: "b" },
      { id: 1, name: "c" },
    ];
    const result = [...query.compile("unique(.id)")(input)];
    expect(result).toEqual([
      { id: 1, name: "a" },
      { id: 2, name: "b" },
    ]);
  });

  it("sort by key", () => {
    const input = [{ x: 3 }, { x: 1 }, { x: 2 }];
    const result = [...query.compile("sort(.x)")(input)];
    expect(result).toEqual([{ x: 1 }, { x: 2 }, { x: 3 }]);
  });

  it("entries converts object to key/value pairs", () => {
    const input = { a: 1, b: 2 };
    const result = [...query.compile("entries(.)")(input)];
    expect(result).toEqual([
      { key: "a", value: 1 },
      { key: "b", value: 2 },
    ]);
  });

  it("keys returns object keys", () => {
    const input = { a: 1, b: 2, c: 3 };
    const result = [...query.compile("keys(.)")(input)];
    expect(result).toEqual(["a", "b", "c"]);
  });

  it("values returns object values", () => {
    const input = { a: 1, b: 2, c: 3 };
    const result = [...query.compile("values(.)")(input)];
    expect(result).toEqual([1, 2, 3]);
  });

  it("fromEntries converts key/value pairs to object", () => {
    const input = [
      { key: "a", value: 1 },
      { key: "b", value: 2 },
    ];
    const result = query.compile("fromEntries(.)")(input);
    expect(result).toEqual({ a: 1, b: 2 });
  });

  it("entries | fromEntries roundtrip", () => {
    const input = { x: 10, y: 20 };
    const result = query.compile("entries(.) | fromEntries(.)")(input);
    expect(result).toEqual({ x: 10, y: 20 });
  });

  it("mapValues transforms object values", () => {
    const input = { a: 1, b: 2, c: 3 };
    const result = query.compile("mapValues(. * 2)")(input);
    expect(result).toEqual({ a: 2, b: 4, c: 6 });
  });

  it("groupBy with mapValues count", () => {
    const input = [
      { type: "a" },
      { type: "b" },
      { type: "a" },
      { type: "a" },
      { type: "b" },
    ];
    const result = query.compile("groupBy(.type) | mapValues(count())")(input);
    expect(result).toEqual({ a: 3, b: 2 });
  });
});
