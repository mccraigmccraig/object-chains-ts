import { assertEquals } from "assert"
import { Effect, Context } from "effect"
import { invokeFxServiceFn } from "./fx_service_fn.ts"
import { buildObjectStepFn, chainObjectStepsProg, tupleMapObjectStepsProg } from "./object_builders.ts"

export type Org = {
    id: string
    name: string
}
interface OrgService { readonly _: unique symbol }
export interface OrgServiceI {
    readonly getById: (id: string) => Effect.Effect<never, never, Org>
    readonly getByNick: (nick: string) => Effect.Effect<never, never, Org>
}
export const OrgService = Context.Tag<OrgService, OrgServiceI>("OrgService")

// $ExpectType FxServiceFn<string, OrgService, never, Org>
export const getOrgByNick = invokeFxServiceFn(OrgService, "getByNick")

export type User = {
    id: string
    name: string
}
interface UserService { readonly _: unique symbol }
// the service interface
export interface UserServiceI {
    readonly getByIds: (d: { org_id: string, user_id: string }) => Effect.Effect<never, never, User>
}
export const UserService = Context.Tag<UserService, UserServiceI>("UserService")

// $ExpectType FxServiceFn<{org_id: string, user_id: string}, UserService, never, User>
export const getUserByIds = invokeFxServiceFn(UserService, "getByIds")

//////////////////////////////////////////////////////////////////////////////

// then some computation steps...

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


// a simple context with an OrgService which echos data back
const orgEchoContext = Context.empty().pipe(
    Context.add(OrgService, OrgService.of({
        getById: (id: string) => Effect.succeed({ id: id, name: id.toString() }),
        getByNick: (nick: string) => Effect.succeed({ id: nick, name: nick })
    })))




Deno.test("buildObjectStepFn runs a step", () => {
    const stepFn = buildObjectStepFn<{ data: { org_nick: string } }>()(getOrgObjectStepSpec)

    const input = { data: { org_nick: "bob" } }
    const stepEffect = stepFn(input)
    const runnable = Effect.provide(stepEffect, orgEchoContext)
    const r = Effect.runSync(runnable)

    assertEquals(r, {...input, ...{org: {id: "bob", name: "bob"}}})
})