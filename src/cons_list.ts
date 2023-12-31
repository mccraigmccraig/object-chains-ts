
// a None element marking an empty cons list 
// or the end of a cons list.
export const NoneTag: unique symbol = Symbol("ConsNone")
export type None = { readonly _tag: typeof NoneTag }
export const None: None = { _tag: NoneTag }

// a type-guard for the None type
// deno-lint-ignore no-explicit-any
export function isNone(v: any): v is None {
    return (('_tag' in v) && (v._tag === NoneTag))
}

// it's probably a cons, but we're only checking
// one level with this type
// deno-lint-ignore no-explicit-any
export type NRConsList<T> = None | readonly [T, None | readonly any[]]

// a Cons type with limited conditional recursion
// T is the base type for the values
export type ConsList<T, C> =
    C extends None
    ? None
    : C extends readonly [infer H extends T, infer R]
    ? readonly [H, ConsList<T, R>]
    // don't recurse when there is no match,
    // it murders the compiler
    : never

// prepend an element to a cons list (or 
// start a cons list by prepending to None)
export function cons<T>() {
    return function <V extends T, const C>(
        v: V,
        c: C extends ConsList<T, C> ? C : ConsList<T, C>) {
        return [v, c] as const
    }
}

export type First<T, C> =
    C extends ConsList<T, C>
    ? C extends None
    ? None
    : C extends readonly [infer H extends T, infer _R]
    ? H
    : never
    : never

// get the first element from a cons list
export function first<T>() {
    return function <const C>(c: C extends ConsList<T, C> ? C : ConsList<T, C>)
        : First<T, C> {
        if (isNone(c)) {
            return None as First<T, C>
        } else {
            return c[0] as First<T, C>
        } 
    }
}

export type Rest<T, C> =
    C extends ConsList<T, C>
    ? C extends None
    ? None
    : C extends readonly [infer _H extends T, infer R]
    ? R
    : never
    : never

// get the rest of a cons list
export function rest<T>() {
    return function <const C>(c: C extends ConsList<T, C> ? C : ConsList<T, C>)
        : Rest<T, C> {
        if (isNone(c)) {
            return c as Rest<T, C>
        } else {
            return c[1] as Rest<T, C>
        }
    }
}

export type Last<T, C> =
    C extends None
    ? None
    : C extends readonly [infer F, None]
    ? F
    : C extends readonly [infer _F extends T, infer R]
    ? Last<T, R>
    : never

export function last<T>() {
    return function <const C>(
        c: C extends ConsList<T, C> ? C : ConsList<T, C>) {

        let result: ConsList<T, None> = None
        let cursor = c
        while (!isNone(cursor)) {
            // deno-lint-ignore no-explicit-any
            result = cursor[0] as any
            cursor = cursor[1]
        }

        return result as Last<T, C>

    }
}

export type Reverse<T, C, Acc = None> =
    C extends ConsList<T, C>
    ? C extends None
    ? Acc
    : C extends readonly [infer F extends T, infer R]
    ? Reverse<T, R, readonly [F, Acc]>
    : never
    : never

export function reverse<T>() {
    return function <const C>(c: C extends ConsList<T, C> ? C : ConsList<T, C>) {

        let result: ConsList<T, None> = None
        let cursor = c
        while (!isNone(cursor)) {
            // deno-lint-ignore no-explicit-any
            result = [cursor[0], result] as const as any
            cursor = cursor[1]
        }

        return result as Reverse<T, C>
    }
}

export type Append<T, C, V extends T> =
    C extends None
    ? readonly [V, None]
    : C extends readonly [infer F extends T, infer R]
    ? readonly [F, Append<T, R, V>]
    : never

// append an element to a cons list - 
// NB: builds an entirely new cons list
export function append<T>() {
    return function <const C, V extends T>(
        c: C extends ConsList<T, C> ? C : ConsList<T, C>,
        v: V) {

        // deno-lint-ignore no-explicit-any
        const reversed = reverse<T>()(c) as any
        const prepended = cons<T>()(v, reversed)
        return reverse<T>()(prepended) as Append<T, C, V>
    }
}

export type Concat<T, C1, C2> =
    C1 extends None
    ? C2
    : C1 extends readonly [infer F extends T, infer R]
    ? readonly [F, Concat<T, R, C2>]
    : never

// concatenate a cons list to another cons list
// NB: c2 is appended unchanged to the last 
// element in a new copy of c1
export function concat<T>() {
    return function <const C1, const C2>(
        c1: C1 extends ConsList<T, C1> ? C1 : ConsList<T, C1>,
        c2: C2 extends ConsList<T, C2> ? C2 : ConsList<T, C2>) {
        
        let result = c2
        // deno-lint-ignore no-explicit-any
        let cursor = reverse<T>()(c1) as any 
        while (!isNone(cursor)) {
            // deno-lint-ignore no-explicit-any
            result = [cursor[0], result] as const as any
            // deno-lint-ignore no-explicit-any
            cursor = cursor[1] as any
        }

        return result as Concat<T, C1, C2>
    }
}

export type ToTuple<T, C, Acc extends readonly T[] = []> =
    C extends None
    ? Acc
    : C extends readonly [infer F extends T, infer R]
    ? ToTuple<T, R, readonly [...Acc, F]>
    : never

export function toTuple<T>() {
    return function
        <const C>
        (c: C extends ConsList<T, C> ? C : ConsList<T, C>) {
        
        const result = []
        let cursor = c
        while (!isNone(cursor)) {
            result.push(cursor[0])
            cursor = cursor[1]
        }

        return result as ToTuple<T, C> 
    }
}

export type FromTuple<T,
    // deno-lint-ignore no-explicit-any
    Tuple extends readonly [...any[]],
    Acc extends NRConsList<T> = None> =

    Tuple extends readonly []
    ? Acc
    : Tuple extends readonly [...infer Front,
        infer Last extends T]
    ? FromTuple<T, Front, readonly [Last, Acc]>
    : never

export function fromTuple<T>() {
    return function
        <const Tuple extends readonly [...T[]]>
        (tuple: Tuple) {

        const list = tuple.toReversed().reduce(
            // deno-lint-ignore no-explicit-any
            (l, v) => cons<T>()(v, l) as any,
            None
        )

        return list as FromTuple<T, Tuple>
    }
}