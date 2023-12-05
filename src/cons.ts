
// a None element marking an empty cons list 
// or the end of a cons list
const NoneTag: unique symbol = Symbol("ConsNone")
export type None = { readonly _tag: typeof NoneTag }
export const None: None = { _tag: NoneTag }

// it's probably a cons, but we're avoiding recursive types because 
// they seem to make the compiler choke
// deno-lint-ignore no-explicit-any
export type NRCons<T> = None | readonly [T, any]

// unparameterised cons can be used to roughly type arrays
// deno-lint-ignore no-explicit-any
export type UPCons = None | readonly [any, any]

// a Cons type with limited conditional recursion
// T is the base type for the values
export type Cons<T, C = None> =
    C extends None
    ? None
    : C extends readonly [infer H extends T, infer R]
    ? readonly [H, Cons<T, R>]
    // don't recurse when there is no match,
    // it murders the compiler
    : never

// prepend an element to a cons list (or 
// start a cons list by prepending to None)
export function cons<T>() {
    return function <V extends T, const C>(
        v: V,
        c: C extends Cons<T, C> ? C : Cons<T, C>) {
        return [v, c] as const
    }
}

type First<T, C> =
    C extends Cons<T, C>
    ? C extends None
    ? None
    : C extends readonly [infer H extends T, infer _R]
    ? H
    : never
    : never

// get the first element from a cons list
export function first<T>() {
    return function <const C>(c: C extends Cons<T, C> ? C : Cons<T, C>)
        : First<T, C> {
        if (('_tag' in c) && (c['_tag'] == NoneTag)) {
            return None as First<T, C>
        } else if (!('_tag' in c)) {
            return c[0] as First<T, C>
        } else {
            throw new Error("unknown cons type")
        }
    }
}

type Rest<T, C> =
    C extends Cons<T, C>
    ? C extends None
    ? None
    : C extends readonly [infer _H extends T, infer R]
    ? R
    : never
    : never

// get the rest of a cons list
export function rest<T>() {
    return function <const C>(c: C extends Cons<T, C> ? C : Cons<T, C>)
        : Rest<T, C> {
        if (('_tag' in c) && (c._tag == NoneTag)) {
            return c as Rest<T, C>
        } else if (!('_tag' in c)) {
            return c[1] as Rest<T, C>
        } else {
            throw new Error("unknown cons type")
        }
    }
}

// itereatively build a list
export const a = cons<number>()(10, None)
export const b = cons<number>()(11, a)
export const c = cons<number>()(12, b)

// get some first elements
export const hn = first<number>()(None)
export const ha = first<number>()(a)
export const hb = first<number>()(b)
export const hc = first<number>()(c)

// get some rests
export const ra = rest()(a)
export const rb = rest()(b)
export const rc = rest()(c)