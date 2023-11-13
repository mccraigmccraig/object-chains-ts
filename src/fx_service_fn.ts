import { Effect, Context } from "effect"

// FxFn is a simple interface for an effectful computation step.
// It takes a single parameter and returns an Effect.Effect
export type FxFn<D, R, E, V> = (d: D) => Effect.Effect<R, E, V>

// check that S[K] is an FxFn as required
type CheckFxFnTag<I, S, K extends keyof S> =
    S[K] extends FxFn<infer _D, infer _R, infer _E, infer _V>
    ? Context.Tag<I, S>
    : never

// add the service to the FxFn result's R
type invokeServiceFxFnResult<I, S, K extends keyof S> =
    S[K] extends FxFn<infer D, infer R, infer E, infer V>
    ? FxFn<D, R | I, E, V>
    : never

// infer the FxFn data param
type invokeServiceFxFnParam<_I, S, K extends keyof S> =
    S[K] extends FxFn<infer D, infer _R, infer _E, infer _V>
    ? D
    : never

// makes an FxFn, by looking up an FxFn from 
// a service and invoking it. Adds the service into R. the
// boilerplate of fetching the service disappears
export const invokeServiceFxFn = <I, S, K extends keyof S>(tag: CheckFxFnTag<I, S, K>, k: K): invokeServiceFxFnResult<I, S, K> => {
    const rf = (d: invokeServiceFxFnParam<I, S, K>) => {
        return Effect.gen(function* (_) {
            const svc = yield* _(tag)
            const fn = svc[k]

            if (typeof fn === 'function') {
                const r = yield* _(fn(d))
                return r
            } else {
                throw new Error("no FxFn: " + tag.toString() + ", " + k.toString())
            }
        })
    }
    return rf as invokeServiceFxFnResult<I, S, K>
}