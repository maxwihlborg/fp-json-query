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
  subject = subject || "build";
  status = status || "unknown";
  color = color || "lightgrey";

  return `<img src="https://img.shields.io/badge/${subject}-${status}-${color}.svg" alt="${subject}">`;
}

/**
 * @param {string} id
 * @param {(content:string)=>Promise<string>|string} fn
 * @returns{(content:string)=>Promise<string>}
 */
function sub(id, fn) {
  return async (content) => {
    const s = new RegExp(`<!--\\s*BEGIN\\s+${id}\\s*-->`, "i").exec(content);
    assert(s);
    const e = /<!--\s*END\s*-->/i.exec(content.substring(s.index));
    assert(e);

    return (
      content.substring(0, s.index + s[0].length + 1) +
      (await fn(content)) +
      content.substring(s.index + e.index - 1)
    );
  };
}

/**
 * @param {string[]} args
 */
async function fq(...args) {
  const pid = spawn(path.resolve(__dirname, "../bin/cli.js"), args, {
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
        shell: true,
      });
      const [status] = await once(pid, "close");

      return nls([
        '<div style="display: flex; gap: 0.5rem">',
        qbg("version", pkg.version, "blue"),
        status > 0
          ? qbg("tests", "fail", "red")
          : qbg("tests", "passing", "green"),
        `<a href="https://www.npmjs.com/package/fp-json-cli"><img src="https://img.shields.io/npm/v/fp-json-cli" alt="NPM Version"></a>`,
        "</div>",
      ]);
    }),
  )
  .then(
    sub("TOC", (cnt) => {
      return nls(
        ["**Table of Contents**", ""].concat(
          Array.from(cnt.matchAll(/^(?<lvl>#+)\s*(?<title>[^\n]+)$/gm)).reduce(
            /**
             * @param {string[]} acc
             */
            (acc, m) => {
              const { lvl, title } = m.groups ?? {};
              if (!(lvl && title && lvl.length > 1)) {
                return acc;
              }
              acc.push(
                `${" ".repeat((lvl.length - 2) * 2)}- [${title.trim()}](#${title.trim().toLowerCase().replace(/\s+/g, "-")})`,
              );

              return acc;
            },
            [],
          ),
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
      /** @type {{name:string,alias:string[]}[]} */
      let arr = await fq("list", "--json").then((str) => JSON.parse(str));
      const a = arr.reduce((a, b) => Math.max(a, b.name.length), 0);
      const b = arr.reduce((a, b) => Math.max(a, b.alias.join(", ").length), 0);

      const lines = [
        `| ${"Name".padEnd(a)} | ${"Alias".padEnd(b)} |`,
        `| ${":".padEnd(a, "-")} | ${":".padEnd(b, "-")} |`,
      ].concat(
        arr.map(
          ({ name, alias }) =>
            `| ${name.padEnd(a)} | ${alias.join(", ").padEnd(b)} |`,
        ),
      );

      return nls(lines);
    }),
  )
  .then((content) => fs.writeFile(readmePath, content));
