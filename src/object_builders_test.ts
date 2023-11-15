import { assertEquals } from "assert"
import { Effect, Context } from "effect"
import { objectStepFn, chainObjectStepsProg, tupleMapObjectStepsProg } from "./object_builders.ts"
import { Org, User, OrgService, getOrgByNick, UserService, getUserByIds } from "./test_services.ts"

// some computation steps...

// as const is required to prevent the k from being widened to a string type
// and to ensure the specs array is interpreted as a tuple
const getOrgObjectStepSpec /* : ObjectStepSpec<"org", { data: { org_nick: string } }, string, OrgService, never, Org> */ =
{
    k: "org" as const,
    inFn: (d: { data: { org_nick: string } }) => d.data.org_nick,
    fxFn: getOrgByNick
}
const getUserObjectStepSpec /* : ObjectStepSpec<"user", { data: { user_id: string }, org: Org }, {org_id: string, user_id: string}, UserService, never, User> */ =
{
    k: "user" as const,
    // note that this fn depends on the output of an OrgServiceI.getBy* step
    inFn: (d: { data: { user_id: string }, org: Org }) => { return { org_id: d.org.id, user_id: d.data.user_id } },
    fxFn: getUserByIds
}

const formatUserStepSpec = 
{
    k: "formatUser" as const,
    pureFn: (d: {org: Org, user: User}) => "User: " + d.user.name + " @ " + d.org.name
}

export const stepSpecs = [
    getOrgObjectStepSpec,
    getUserObjectStepSpec,
    formatUserStepSpec
] as const


// a simple context with an OrgService and a UserService which echo data back
const echoContext = Context.empty().pipe(
    Context.add(OrgService, OrgService.of({
        getById: (id: string) => Effect.succeed({ id: id, name: "Foo" }),
        getByNick: (nick: string) => Effect.succeed({ id: nick, name: "Foo" })
    })),
    Context.add(UserService, UserService.of({
        getByIds: (d: { org_id: string, user_id: string }) => Effect.succeed({ id: d.user_id, name: "Bar" })
    })))


Deno.test("objectStepFn runs an Fx step", () => {
    const stepFn = objectStepFn<{ data: { org_nick: string } }>()(getOrgObjectStepSpec)

    const input = { data: { org_nick: "foo" } }
    const stepEffect = stepFn(input)
    const runnable = Effect.provide(stepEffect, echoContext)
    const r = Effect.runSync(runnable)

    assertEquals(r, { org: { id: "foo", name: "Foo" } })
})

Deno.test("objectStepFn runs a pure step", () => {
    const stepFn = objectStepFn<{ org: Org, user: User }>()(formatUserStepSpec)

    const input = {
        org: { id: "foo", name: "Foo" },
        user: { id: "100", name: "Bar" }
}
    const stepEffect = stepFn(input)
    const r = Effect.runSync(stepEffect)

    assertEquals(r, { formatUser: "User: Bar @ Foo" })
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
        user: { id: "100", name: "Bar" },
        formatUser: "User: Bar @ Foo"
    })
})

Deno.test("tupleMapObjectStepsProg maps steps over a tuple", () => {

    // inputs are a bit contrived, to re-use the same servces as the chain op
    type INPUT = readonly [
        { data: { org_nick: string } },
        { data: { user_id: string }, org: Org },
        { org: Org, user: User}]

    const input = [
        { data: { org_nick: "foo" } },
        { data: { user_id: "100" }, org: { id: "foo", name: "Foo" } },
        {org: { id: "foo", name: "Foo" }, user: { id: "100", name: "Bar" }}
    ] as const

    const tupleMapEffect = tupleMapObjectStepsProg<INPUT>()(stepSpecs)(input)

    const runnable = Effect.provide(tupleMapEffect, echoContext)

    const r = Effect.runSync(runnable)

    assertEquals(r, {
        org: { id: "foo", name: "Foo" },
        user: { id: "100", name: "Bar" },
        formatUser: "User: Bar @ Foo"
    })
})


