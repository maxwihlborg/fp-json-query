alias b := build
alias d := dev
alias i := install
alias t := test

@default:
    just --list

build:
    pnpm run build

test:
    pnpm run test --run

dev: build
    ./bin/cli.js

install:
    pnpm install
