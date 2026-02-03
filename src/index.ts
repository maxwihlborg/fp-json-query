#!/usr/bin/env node

import fs from "node:fs";

import type { Readable, Writable } from "node:stream";

import { cac } from "cac";

import { dim } from "colorette";
import * as ops from "./operators";
import * as printer from "./printer";
import * as query from "./query";

const name = "fq";
const cli = cac(name);

interface Options {
  out?: string;
  commit: boolean;
  indent: number;
  color: boolean;
  showAst: boolean;
  showIr: boolean;
}

cli
  .command("<query> [file]", "Run fp style operators on input file or stdin")
  .option("-o, --out <path>", "Write the result to a file")
  .option("-c, --commit", "Update file in place when reading from a file", {
    default: false,
  })
  .option("-n, --indent <number>", "Indent level", {
    default: 4,
  })
  .option("--color", "Color output", {
    default: true,
  })
  .option("--show-ast", "Dump AST to stdout", {
    default: false,
  })
  .option("--show-ir", "Dump intermediate representation to stdout", {
    default: false,
  })
  .example(
    `${name} "map(union(pick(email, name), project(age, meta.age)) | filter(.age > 2)" users.json`,
  )
  .action(async (q: string, file: string | undefined, options: Options) => {
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
      : file != null && options.commit
        ? fs.createWriteStream(file)
        : process.stdout;

    if (out == null) {
      process.stdout.write(`${dim(String(out))}\n`);
    } else {
      const toFile = options.out != null || (file != null && options.commit);
      const color = !toFile && options.color;
      printer.print(outputStream, out, { ...options, color });
    }
  });

cli
  .command("list", "List available operators")
  .option("-n, --indent <number>", "Indent level")
  .option("--json", "Return operations as JSON")
  .action(async (options: { json: boolean; indent?: number }) => {
    const arr = Object.entries(ops)
      .map(([name, op]) => ({
        name,
        alias: op.meta.alias,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    if (options.json) {
      printer.print(process.stdout, arr, options);
      return;
    }

    const max = arr.reduce((a, b) => Math.max(a, b.name.length), 0);

    process.stdout.write(`  ${"Name".padEnd(max)} Alias\n\n`);
    for (const { name, alias } of arr) {
      process.stdout.write(`  ${name.padEnd(max)} ${alias.join(", ")}\n`);
    }
  });

cli.help();
cli.version("0.1.5");

try {
  cli.parse(process.argv, { run: false });
  await cli.runMatchedCommand();
} catch (e) {
  if (e instanceof Error) {
    console.log(e.message);
  }
  process.exit(1);
}
