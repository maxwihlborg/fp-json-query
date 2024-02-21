#!/usr/bin/env node

async function start() {
  return import("../dist/index.js");
}

start();
