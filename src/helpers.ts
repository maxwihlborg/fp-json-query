export function isIterable(arg: unknown): arg is Iterable<unknown> {
  return arg != null && typeof arg === "object" && Symbol.iterator in arg;
}
