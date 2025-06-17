#!/usr/bin/env node

import fs from "node:fs";

import type { Readable, Writable } from "node:stream";

import { cac } from "cac";

import * as ops from "./operators";
import * as query from "./query";

const name = "fq";
const cli = cac(name);

function isIterableIteratorLike(arg: unknown): arg is IterableIterator<any> {
  return Boolean(
    arg &&
      typeof (arg as any)[Symbol.iterator] === "function" &&
      typeof (arg as any).next === "function",
  );
}

cli
  .command("<query> [file]", "Run fp style operators on input file or stdin")
  .option("-o, --out <path>", "Write the result to a file")
  .option("--no-nl", "Control new line at the end output")
  .option("--show-ast", "Dump AST to stdout")
  .option("--show-ir", "Dump intermediate representation to stdout")
  .example(
    `${name} "map(union(pick(email, name), project(age, meta.age)) | filter(.age > 2)" users.json`,
  )
  .action(
    async (
      q: string,
      file: string | undefined,
      options: {
        out?: string;
        nl: boolean;
        showAst?: boolean;
        showIr?: boolean;
      },
    ) => {
      if (options.showAst) {
        process.stdout.write(`ex: ${q}\n`);
        for (const line of query.show(query.parse(q))) {
          process.stdout.write(line + "\n");
        }
        return;
      }
      if (options.showIr) {
        process.stdout.write(`ex: ${q}\n`);
        for (const line of query.show(query.reduce(query.parse(q)))) {
          process.stdout.write(line + "\n");
        }
        return;
      }

      const program = query.compile(q);

      const inputStream: Readable = file
        ? fs.createReadStream(file)
        : process.stdin;

      let buffer = Buffer.from("", "utf8");
      for await (const chunk of inputStream) {
        buffer = Buffer.concat([buffer, chunk]);
      }

      const out = program(JSON.parse(buffer.toString()));

      const outputStream: Writable = options.out
        ? fs.createWriteStream(options.out)
        : process.stdout;

      if (isIterableIteratorLike(out)) {
        outputStream.write(JSON.stringify(Array.from(out), null, 2));
      } else if (typeof out === "object") {
        outputStream.write(JSON.stringify(out, null, 2));
      } else {
        outputStream.write(String(out));
      }
      if (options["nl"]) {
        outputStream.write("\n");
      }
    },
  );

cli
  .command("list", "List available operators")
  .option("--json", "Return operations as JSON")
  .action((options: { json?: boolean }) => {
    const arr = Object.entries(ops)
      .map(([name, op]) => ({
        name,
        alias: op.meta.alias,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    if (options.json) {
      process.stdout.write(JSON.stringify(arr));
      return;
    }

    const max = arr.reduce((a, b) => Math.max(a, b.name.length), 0);

    process.stdout.write(`  ${"Name".padEnd(max)} Alias\n\n`);
    for (const { name, alias } of arr) {
      process.stdout.write(`  ${name.padEnd(max)} ${alias.join(", ")}\n`);
    }
  });

cli.help();
cli.version("0.1.0");

try {
  cli.parse(process.argv, { run: false });
  await cli.runMatchedCommand();
} catch (e) {
  if (e instanceof Error) {
    console.log(e.message);
  }
  process.exit(1);
}
