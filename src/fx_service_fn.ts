import { Effect, Context } from "effect"

// FxServiceFn is a simple interface for an effectful computation step.
// It takes a single parameter and returns an Effect.Effect
export type FxServiceFn<D, R, E, V> = (d: D) => Effect.Effect<R, E, V>

// one way to make an FxServiceFns is to fetch a fn from a tagged Service
type FxServiceTag<I, S> = Context.Tag<I, S>

// check that S[K] is an FxServiceFn as required
type CheckFxServiceFnTag<I, S, K extends keyof S> =
    S[K] extends FxServiceFn<infer _D, infer _R, infer _E, infer _V>
    ? FxServiceTag<I, S>
    : never

// add the service to the FxServiceFn result's R
type InvokeFxServiceFnResult<I, S, K extends keyof S> =
    S[K] extends FxServiceFn<infer D, infer R, infer E, infer V>
    ? FxServiceFn<D, R | I, E, V>
    : never

// infer the FxServiceFn data param
type InvokeFxServiceFnParam<_I, S, K extends keyof S> =
    S[K] extends FxServiceFn<infer D, infer _R, infer _E, infer _V>
    ? D
    : never

// makes an FxServiceFn, by looking up an FxServiceFn from 
// a service and invoking it. Adds the service into R - the
// boilerplate of fetching the service disappears
export const invokeFxServiceFn = <I, S, K extends keyof S>(tag: CheckFxServiceFnTag<I, S, K>, k: K): InvokeFxServiceFnResult<I, S, K> => {
    const rf = (d: InvokeFxServiceFnParam<I, S, K>) => {
        return Effect.gen(function* (_) {
            const svc = yield* _(tag)
            const fn = svc[k]

            if (typeof fn === 'function') {
                const r = yield* _(fn(d))
                return r
            } else {
                throw new Error("no FxServiceFn: " + tag.toString() + ", " + k.toString())
            }
        })
    }
    return rf as InvokeFxServiceFnResult<I, S, K>
}