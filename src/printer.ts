import { Readable, type Writable } from "node:stream";
import { createInterface } from "node:readline";

import { createColors, isColorSupported } from "colorette";

enum TokenType {
  ArrayStart,
  ArrayEnd,
  ObjectStart,
  ObjectEnd,
  Key,
  String,
  Number,
  Boolean,
  Null,
  Comma,
  Colon,
}

export type JsonToken =
  | { t: TokenType.ArrayStart }
  | { t: TokenType.ArrayEnd }
  | { t: TokenType.ObjectStart }
  | { t: TokenType.ObjectEnd }
  | { t: TokenType.Key; v: string }
  | { t: TokenType.String; v: string }
  | { t: TokenType.Number; v: number }
  | { t: TokenType.Boolean; v: boolean }
  | { t: TokenType.Null }
  | { t: TokenType.Comma }
  | { t: TokenType.Colon };

export interface PrintOptions {
  indent: number;
  color: boolean;
}

export function isIterable(arg: unknown): arg is Iterable<unknown> {
  return arg != null && typeof arg === "object" && Symbol.iterator in arg;
}

function createTheme(useColor: boolean) {
  const { blue, green, yellow, magenta, gray } = createColors({ useColor });
  return {
    key: blue,
    str: green,
    num: yellow,
    bool: magenta,
    null: gray,
    bracket: String,
    punctuation: String,
  };
}

function* tokenizeIterable(it: Iterable<unknown>): IterableIterator<JsonToken> {
  yield { t: TokenType.ArrayStart };
  let first = true;
  for (const v of it) {
    if (first) {
      first = false;
    } else {
      yield { t: TokenType.Comma };
    }
    yield* tokenizeValue(v);
  }
  yield { t: TokenType.ArrayEnd };
}

function* tokenizeObject(
  obj: Record<string, unknown>,
): IterableIterator<JsonToken> {
  yield { t: TokenType.ObjectStart };
  const keys = Object.keys(obj);
  for (let i = 0; i < keys.length; i++) {
    if (i > 0) yield { t: TokenType.Comma };
    yield { t: TokenType.Key, v: keys[i] };
    yield { t: TokenType.Colon };
    yield* tokenizeValue(obj[keys[i]]);
  }
  yield { t: TokenType.ObjectEnd };
}

function* tokenizeValue(value: unknown): IterableIterator<JsonToken> {
  if (value == null) {
    yield { t: TokenType.Null };
  } else if (typeof value === "boolean") {
    yield { t: TokenType.Boolean, v: value };
  } else if (typeof value === "number") {
    yield { t: TokenType.Number, v: value };
  } else if (typeof value === "string") {
    yield { t: TokenType.String, v: value };
  } else if (isIterable(value)) {
    yield* tokenizeIterable(value);
  } else if (typeof value === "object") {
    yield* tokenizeObject(value as Record<string, unknown>);
  }
}

export function* tokenize(value: unknown): IterableIterator<JsonToken> {
  yield* tokenizeValue(value);
}

export function* render(
  tokens: Iterable<JsonToken>,
  opts: PrintOptions,
): IterableIterator<string> {
  const indentSize = opts.indent ?? 2;
  const theme = createTheme(opts.color && isColorSupported);
  let depth = 0;
  let needsIndent = false;

  const indent = () => "\n" + " ".repeat(depth * indentSize);

  for (const tok of tokens) {
    if (
      needsIndent &&
      tok.t !== TokenType.ArrayEnd &&
      tok.t !== TokenType.ObjectEnd
    ) {
      yield indent();
      needsIndent = false;
    }

    switch (tok.t) {
      case TokenType.ArrayStart:
        yield theme.bracket("[");
        depth++;
        needsIndent = true;
        break;
      case TokenType.ArrayEnd:
        depth--;
        if (!needsIndent) yield indent();
        yield theme.bracket("]");
        needsIndent = false;
        break;
      case TokenType.ObjectStart:
        yield theme.bracket("{");
        depth++;
        needsIndent = true;
        break;
      case TokenType.ObjectEnd:
        depth--;
        if (!needsIndent) yield indent();
        yield theme.bracket("}");
        needsIndent = false;
        break;
      case TokenType.Key:
        yield theme.key(JSON.stringify(tok.v));
        break;
      case TokenType.Colon:
        yield theme.punctuation(": ");
        break;
      case TokenType.Comma:
        yield theme.punctuation(",");
        needsIndent = true;
        break;
      case TokenType.String:
        yield theme.str(JSON.stringify(tok.v));
        break;
      case TokenType.Number:
        yield theme.num(String(tok.v));
        break;
      case TokenType.Boolean:
        yield theme.bool(String(tok.v));
        break;
      case TokenType.Null:
        yield theme.null("null");
        break;
    }
  }
  yield "\n";
}

export function print(w: Writable, value: unknown, options: PrintOptions) {
  Readable.from(render(tokenize(value), options)).pipe(w);
}
