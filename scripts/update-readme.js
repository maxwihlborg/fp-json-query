#!/usr/bin/env node
// @ts-check
import assert from "node:assert";
import fs from "node:fs/promises";
import path from "node:path";

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { once } from "node:events";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const readmePath = path.resolve(__dirname, "../readme.md");
("use strict");

/**
 * @link{https://github.com/CodeDotJS/quick-badge-generator/blob/master/index.js}
 *
 * @param {string} subject
 * @param {string} status
 * @param {string} color
 */
function qbg(subject, status, color) {
  return `![${subject}](https://img.shields.io/badge/${subject}-${status}-${color}.svg)`;
}

/**
 * @param {string} id
 * @param {(content:string)=>Promise<string>|string} fn
 * @returns{(content:string)=>Promise<string>}
 */
function sub(id, fn) {
  const re = new RegExp(
    `<!--\\s*BEGIN\\s+${id}\\s*-->(:?[^]*?)<!--\\s*END\\s+${id}\\s*-->`,
    "igm",
  );
  return async (content) => {
    const next = await fn(content);
    return content.replace(re, () => {
      return `<!-- BEGIN ${id} -->\n${next}\n<!-- END ${id} -->`;
    });
  };
}

/**
 * @param {string[]} args
 */
async function fq(...args) {
  const pid = spawn(path.resolve(__dirname, "../dist/index.js"), args, {
    stdio: "pipe",
    shell: false,
  });
  let buf = Buffer.from("");
  for await (const chunk of pid.stdout) {
    buf = Buffer.concat([buf, chunk]);
  }
  return buf.toString().trim();
}

/**
 * @param {string[]} str
 */
function nls(str) {
  return `\n${str.join("\n").trim()}\n`;
}

await fs
  .readFile(readmePath)
  .then((b) => b.toString())
  .then(
    sub("BADGES", async () => {
      const pkg = await fs
        .readFile(path.resolve(__dirname, "../package.json"))
        .then((b) => JSON.parse(b.toString()));

      const pid = spawn("pnpm", ["vitest", "run"], {
        stdio: "inherit",
        shell: true,
      });
      const [status] = await once(pid, "close");

      return nls([
        qbg("version", pkg.version, "blue"),
        status > 0
          ? qbg("tests", "failing", "red")
          : qbg("tests", "passing", "green"),
        `[![NPM Version](https://img.shields.io/npm/v/fp-json-cli)](https://www.npmjs.com/package/fp-json-cli)`,
      ]);
    }),
  )
  .then(
    sub("TOC", (content) => {
      return nls(
        Array.from(
          content.matchAll(/^(?<lvl>#+)\s*(?<title>[^\n]+)$/gm),
        ).reduce(
          (acc, m) => {
            const { lvl, title } = m.groups ?? {};
            if (!(lvl && title && lvl.length > 1)) {
              return acc;
            }
            acc.push(
              `${"  ".repeat(lvl.length - 2)}- [${title.trim()}](#${title.trim().toLowerCase().replace(/\s+/g, "-")})`,
            );

            return acc;
          },
          ["**Table of Contents**", ""],
        ),
      );
    }),
  )
  .then(
    sub("USAGE", async () => {
      let out = await fq("-h");
      return nls(["```", out, "```"]);
    }),
  )
  .then(
    sub("OPS", async () => {
      /** @type {{name:string,alias:string[],symbol?:string}[]} */
      let arr = await fq("list", "--json").then((str) => JSON.parse(str));
      const a = arr.reduce((a, b) => Math.max(a, b.name.length), "Name".length);
      const b = arr.reduce(
        (a, b) => Math.max(a, b.alias.join(", ").length),
        "Alias".length,
      );
      const c = arr.reduce(
        (a, b) => Math.max(a, (b.symbol ?? "").length),
        "Symbol".length,
      );

      return nls(
        arr.reduce(
          (acc, { name, alias, symbol }) => {
            acc.push(
              `| ${name.padEnd(a)} | ${alias.join(", ").padEnd(b)} | ${(symbol ?? "").padEnd(c)} |`,
            );
            return acc;
          },
          [
            `| ${"Name".padEnd(a)} | ${"Alias".padEnd(b)} | ${"Symbol".padEnd(c)} |`,
            `| ${":".padEnd(a, "-")} | ${":".padEnd(b, "-")} | ${":".padEnd(c, "-")} |`,
          ],
        ),
      );
    }),
  )
  .then((content) => fs.writeFile(readmePath, content));
