import { assertEquals } from "assert"
import { Effect, Context } from "effect"
import { objectStepFn, chainObjectStepsProg, tupleMapObjectStepsProg } from "./object_builders.ts"
import { Org, OrgService, getOrgByNick, UserService, getUserByIds } from "./test_services.ts"

// some computation steps...

// as const is required to prevent the k from being widened to a string type
// and to ensure the specs array is interpreted as a tuple
const getOrgObjectStepSpec /* : ObjectStepSpec<"org", { data: { org_nick: string } }, string, OrgService, never, Org> */ =
{
    k: "org" as const,
    inFn: (d: { data: { org_nick: string } }) => d.data.org_nick,
    svcFn: getOrgByNick
}
const getUserObjectStepSpec /* : ObjectStepSpec<"user", { data: { user_id: string }, org: Org }, {org_id: string, user_id: string}, UserService, never, User> */ =
{
    k: "user" as const,
    // note that this fn depends on the output of an OrgServiceI.getBy* step
    inFn: (d: { data: { user_id: string }, org: Org }) => { return { org_id: d.org.id, user_id: d.data.user_id } },
    svcFn: getUserByIds
}
export const stepSpecs = [
    getOrgObjectStepSpec,
    getUserObjectStepSpec
] as const

// and finally, the object builder programs... 

// a program to build an Object by chaining the accumulating Object through the steps
//
// $ExpectType const chainProg: (arg: {
//     data: {
//         org_nick: string;
//         user_id: string;
//     };
// }) => Effect.Effect<never, never, {
//     data: {
//         org_nick: string;
//         user_id: string;
//     };
//     org: Org;
//     user: User;
// }>
export const chainProg = chainObjectStepsProg<{ data: { org_nick: string, user_id: string } }>()(stepSpecs)

// a program to build an Object by mapping each step over it's corresponding input value
//
// $ExpectType const tupleProg: (inputs: [{
//     data: {
//         org_nick: string;
//     };
// }, {
//     data: {
//         user_id: string;
//     };
//     org: Org;
// }]) => Effect.Effect<never, never, {
//     org: Org;
//     user: User;
// }>
export const tupleProg = tupleMapObjectStepsProg<[{ data: { org_nick: string } }, { data: { user_id: string }, org: Org }]>()(stepSpecs)


// a simple context with an OrgService and a UserService which echo data back
const echoContext = Context.empty().pipe(
    Context.add(OrgService, OrgService.of({
        getById: (id: string) => Effect.succeed({ id: id, name: "Foo" }),
        getByNick: (nick: string) => Effect.succeed({ id: nick, name: "Foo" })
    })),
    Context.add(UserService, UserService.of({
        getByIds: (d: { org_id: string, user_id: string }) => Effect.succeed({ id: d.user_id, name: "Bar" })
    })))


Deno.test("buildObjectStepFn runs a step", () => {
    const stepFn = objectStepFn<{ data: { org_nick: string } }>()(getOrgObjectStepSpec)

    const input = { data: { org_nick: "foo" } }
    const stepEffect = stepFn(input)
    const runnable = Effect.provide(stepEffect, echoContext)
    const r = Effect.runSync(runnable)

    assertEquals(r, { org: { id: "foo", name: "Foo" } })
})

Deno.test("chainObjectStepsProg chains steps", () => {

    type INPUT = { data: { org_nick: string, user_id: string } }
    const input = { data: { org_nick: "foo", user_id: "100" } }

    const chainEffect = chainObjectStepsProg<INPUT>()(stepSpecs)(input)

    const runnable = Effect.provide(chainEffect, echoContext)

    const r = Effect.runSync(runnable)

    assertEquals(r, {
        ...input,
        org: { id: "foo", name: "Foo" },
        user: { id: "100", name: "Bar" }
    })
})

Deno.test("tupleMapObjectStepsProg maps steps over a tuple", () => {

    // inputs are a bit contrived, to re-use the same servces as the chain op
    type INPUT = readonly [
        { data: { org_nick: string } },
        { data: { user_id: string }, org: Org }]

    const input = [
        { data: { org_nick: "foo" } },
        { data: { user_id: "100" }, org: { id: "foo", name: "Foo" } }
    ] as const

    const tupleMapEffect = tupleMapObjectStepsProg<INPUT>()(stepSpecs)(input)

    const runnable = Effect.provide(tupleMapEffect, echoContext)

    const r = Effect.runSync(runnable)

    assertEquals(r, {
        org: { id: "foo", name: "Foo" },
        user: { id: "100", name: "Bar" }
    })
})


