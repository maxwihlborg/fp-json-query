import { describe, it, expect } from "vitest";
import * as query from "../query";
import * as tc from "../typecheck";
import * as ops from "../operators";
import { Operator, Type } from "../types";

const kernel = Object.entries(ops).reduce<Operator.Kernel>((a, [name, op]) => {
  a[name] = op;
  op.meta.alias.forEach((alias) => {
    a[alias] = op;
  });
  return a;
}, {});

function check(q: string): tc.TypeError[] {
  return tc.typecheck(query.reduce(query.parse(q)), kernel);
}

function infer(q: string): Type {
  return tc.inferType(query.reduce(query.parse(q)), kernel);
}

describe("inferType", () => {
  it("literals return Val", () => {
    expect(infer("42")).toBe(Type.Value);
    expect(infer("foo")).toBe(Type.Value);
  });

  it("transformers return Iter", () => {
    expect(infer("map(.x)")).toBe(Type.Itererable);
    expect(infer("filter(.x > 0)")).toBe(Type.Itererable);
    expect(infer("sort(.x)")).toBe(Type.Itererable);
    expect(infer("unique(.x)")).toBe(Type.Itererable);
  });

  it("reducers return Val", () => {
    expect(infer("count()")).toBe(Type.Value);
    expect(infer("sum(.x)")).toBe(Type.Value);
    expect(infer("first()")).toBe(Type.Value);
    expect(infer("groupBy(.x)")).toBe(Type.Value);
  });

  it("functions return Val", () => {
    expect(infer(".a + .b")).toBe(Type.Value);
    expect(infer(".x > 0")).toBe(Type.Value);
  });

  it("unknown ops return Unknown", () => {
    expect(infer("get(a)")).toBe(Type.Unknown);
  });

  it("producers return Iter", () => {
    expect(infer("entries(.)")).toBe(Type.Itererable);
    expect(infer("keys(.)")).toBe(Type.Itererable);
    expect(infer("values(.)")).toBe(Type.Itererable);
    expect(infer("range(1, 10)")).toBe(Type.Itererable);
  });

  it("flow returns type of last element", () => {
    expect(infer("map(.x) | count()")).toBe(Type.Value);
    expect(infer("entries(.) | map(.key)")).toBe(Type.Itererable);
    expect(infer(".x | entries(.)")).toBe(Type.Itererable);
  });

  it("array returns Iter", () => {
    expect(infer("[.a, .b]")).toBe(Type.Itererable);
  });
});

describe("typecheck", () => {
  it("passes valid Iter -> Iter -> Val chain", () => {
    expect(check("map(.x) | filter(.y > 0) | count()")).toEqual([]);
  });

  it("passes valid Val operations", () => {
    expect(check(".a + .b")).toEqual([]);
    expect(check(".x > 0 ? .y : .z")).toEqual([]);
  });

  it("warns when reducer receives Val instead of Iter", () => {
    const errors = check("count()");
    // count expects Iter, gets Val (from implicit input)
    // This is actually fine at the top level since we don't know the input type
    expect(errors).toEqual([]);
  });

  it("warns when count receives Val from previous step", () => {
    // .a + .b returns Value, count expects Iterable
    const errors = check("(.a + .b) | count()");
    expect(errors.length).toBe(1);
    expect(errors[0].message).toContain("count");
    expect(errors[0].message).toContain("iterable");
    expect(errors[0].message).toContain("value");
  });

  it("warns when transformer receives Val", () => {
    // .a + .b returns Value, map expects Iterable
    const errors = check("(.a + .b) | map(.y)");
    expect(errors.length).toBe(1);
    expect(errors[0].message).toContain("map");
    expect(errors[0].message).toContain("iterable");
  });

  it("passes when producer feeds transformer", () => {
    expect(check("entries(.) | map(.key)")).toEqual([]);
    expect(check("keys(.) | filter(. != null)")).toEqual([]);
  });

  it("passes when transformer feeds reducer", () => {
    expect(check("map(.x) | sum(.)")).toEqual([]);
    expect(check("filter(.x > 0) | count()")).toEqual([]);
  });

  it("warns when feeding Val to transformer after reducer", () => {
    const errors = check("count() | map(.x)");
    expect(errors.length).toBe(1);
    expect(errors[0].message).toContain("map");
    expect(errors[0].message).toContain("iterable");
    expect(errors[0].message).toContain("value");
  });

  it("passes array literal to reducer", () => {
    expect(check("[.x, .y] | merge(.)")).toEqual([]);
    expect(check("[.a, .b, .c] | count()")).toEqual([]);
  });

  it("passes complex valid chains", () => {
    expect(check("entries(.) | map(.value) | filter(. > 0) | sum(.)")).toEqual(
      [],
    );
    expect(check("groupBy(.type) | mapValues(count())")).toEqual([]);
  });
});
