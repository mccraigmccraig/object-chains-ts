# object-chains-ts

[![CI](https://github.com/mccraigmccraig/object-chains-ts/actions/workflows/test.yml/badge.svg)](https://github.com/mccraigmccraig/object-chains-ts/actions/workflows/test.yml)
[![GitHub](https://img.shields.io/github/license/mccraigmccraig/object-chains-ts)](https://github.com/mccraigmccraig/object-chains-ts/blob/master/LICENSE)
[![Contributors](https://img.shields.io/github/contributors/mccraigmccraig/object-chains-ts)](https://github.com/mccraigmccraig/object-chains-ts/graphs/contributors)
[![Deno Starter](https://img.shields.io/badge/deno-starter-brightgreen)](https://denorg.github.io/starter/)
[![TypeScript](https://img.shields.io/badge/types-TypeScript-blue)](https://github.com/mccraigmccraig/object-chains-ts)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)

## ⭐ Getting started

`object-chains` creates data-driven programs to process messages or events.  

### `ObjectChain`

An individual `ObjectChain` is a program to process a single type of value, and is built from a chain of steps (defined by a list of `ObjectStepSpec`s) into which an object is fed. 

Each step in an `ObjectChain` has a key `K` and is either pure (having a pure function `(arg: A) => V`), or effectful (having both an input-transform `(arg: A) => D` and an `FxFn` -  `(d: D) => Effect.Effect<R, E, V>`). 

The output value `V` from a step's function will be appended to the step's input object at key `K`, forming an output object value which extends `A & {K: V}`. Requirements and Errors of the `FxFn`s of effectful steps propagate upwards to the `ObjectChain` (or `MultiChain`).

The input type `A` of each step in a chain is constrained by the output value of the prior step and the output value of a step constrains the input of the succeeding step. The output of the final step in an `ObjectChain` is returned as the result.

An `ObjectChain` can be invoked as an `FxFn` i.e. `(d: D) => Effect.Effect<R, E, V>`

### `MultiChain`

Multiple `ObjectChains` can be combined into a `MultiChain`, which can also be invoked as an `FxFn`.

`ObjectChains` in a `MultiChain` can invoke other `ObjectChains` in the same `MultiChain` (i.e. a DAG of function dependencies), but immediate recursion (i.e. cyclic function dependencies) is not possible.

### upcoming

* execution control - uniform tracing, logging, and error-handling (including retry-from-failure-point) using the `ObjectStepSpec` data-structures

## genesis 

`object-chains` is built with [Effect](https://github.com/Effect-TS/effect) and began life as an attempt to port [a-frame](https://github.com/yapsterapp/a-frame) to TypeScript

## 📄 License

MIT © mccraigmccraig of the clan mccraig