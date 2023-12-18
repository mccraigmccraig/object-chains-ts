# object-chains-ts

[![CI](https://github.com/mccraigmccraig/object-chains-ts/actions/workflows/test.yml/badge.svg)](https://github.com/mccraigmccraig/object-chains-ts/actions/workflows/test.yml)
[![GitHub](https://img.shields.io/github/license/mccraigmccraig/object-chains-ts)](https://github.com/mccraigmccraig/object-chains-ts/blob/master/LICENSE)
[![Contributors](https://img.shields.io/github/contributors/mccraigmccraig/object-chains-ts)](https://github.com/mccraigmccraig/object-chains-ts/graphs/contributors)
[![Deno Starter](https://img.shields.io/badge/deno-starter-brightgreen)](https://denorg.github.io/starter/)
[![TypeScript](https://img.shields.io/badge/types-TypeScript-blue)](https://github.com/mccraigmccraig/object-chains-ts)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)

## ⭐ Getting started

`object-chains` creates data-driven programs to process messages or 
events.  

An `ObjectChain` is a program to process a single type of value, and is built from a chain of steps, into which an input object is fed. The output of each step contributes a new key/value to the object, which then constitutes the input to the next step, or the result.

Each step in an `ObjectChain` has is either pure (with a pure function `(arg: A) => V`) or effectful (with an `FxFn` -  `(d: D) => Effect.Effect<R, E, V>`). The input type of each step in a chain is constrained by outputs of the prior steps and the output type constrains the input of the succeeding step.

`ObjectChains` can be combined into a `MultiChain`, which can then be invoked as an `FxFn`.

`ObjectChains` in a `MultiChain` can invoke other `ObjectChains` in the same `MultiChain`, but direct recursion is not possible.

### upcoming

* step execution control - implement uniform tracing, logging and error-handling using the `ObjectStepSep` data-structures

### 

`object-chains` is built with [Effect](https://github.com/Effect-TS/effect) and began as a TypeScript port of [a-frame](https://github.com/yapsterapp/a-frame)

## 📄 License

MIT © mccraigmccraig of the clan mccraig