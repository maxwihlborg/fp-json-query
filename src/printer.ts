import { Readable, type Writable } from "node:stream";
import { createInterface } from "node:readline";

import { blue, gray, green, magenta, yellow } from "colorette";
import { isIterable } from "./helpers";

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

export interface PrintOpts {
  indent?: number;
  trailingNewline?: boolean;
}

const id = (s: string) => s;

const theme = {
  key: blue,
  str: green,
  num: yellow,
  bool: magenta,
  null: gray,
  bracket: id,
  punctuation: id,
};

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
  if (value === null) {
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
  opts: PrintOpts = {},
): IterableIterator<string> {
  const indentSize = opts.indent ?? 2;
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
}

async function* lines(chunks: Iterable<string>) {
  for await (const line of createInterface(Readable.from(chunks))) {
    yield line + "\n";
  }
}

export async function printIt(w: Writable, value: Iterable<unknown>) {
  for await (const line of lines(render(tokenizeIterable(value)))) {
    w.write(line);
  }
}

export async function print(w: Writable, value: unknown) {
  for await (const line of lines(render(tokenize(value)))) {
    w.write(line);
  }
}
