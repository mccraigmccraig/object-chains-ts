import { assertEquals } from "assert"
import { Effect } from "effect"
import { objectStepFn, objectChainStepsProg } from "./object_builders.ts"
import { Org, User, getOrgByNick, getUserByIds, testServiceContext } from "./test_services.ts"

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


Deno.test("objectStepFn runs an Fx step", () => {
    const stepFn = objectStepFn<{ data: { org_nick: string } }>()(getOrgObjectStepSpec)

    const input = { data: { org_nick: "foo" } }
    const stepEffect = stepFn(input)
    const runnable = Effect.provide(stepEffect, testServiceContext)
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

Deno.test("objectChainStepsProg empty chain", () => {
    type DoNothing = { data: { org_nick: string } }
    const doNothing = { data: { org_nick: "foo" } }
    
    const chainEffect = objectChainStepsProg<DoNothing>()([])(doNothing)
    const r = Effect.runSync(chainEffect)
    assertEquals(r, doNothing)
})

Deno.test("objectChainStepsProg chains steps", () => {

    type INPUT = { data: { org_nick: string, user_id: string } }
    const input = { data: { org_nick: "foo", user_id: "100" } }

    const chainEffect = objectChainStepsProg<INPUT>()(stepSpecs)(input)

    const runnable = Effect.provide(chainEffect, testServiceContext)

    const r = Effect.runSync(runnable)

    assertEquals(r, {
        ...input,
        org: { id: "foo", name: "Foo" },
        user: { id: "100", name: "Bar" },
        formatUser: "User: Bar @ Foo"
    })
})