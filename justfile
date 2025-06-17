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

dev *args: build
    ./dist/index.js {{ args }}

install:
    pnpm install
