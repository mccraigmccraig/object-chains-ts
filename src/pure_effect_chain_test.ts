import { assertEquals } from "assert"
import { Effect, Context } from "effect"
import { invokeFxServiceFn } from "./fx_service_fn.ts"
import { ObjectStepSpec, ObjectStepsInputTuple } from "./object_builders.ts"
import { makePureFnChain } from "./pure_effect_chain.ts"

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

interface PushNotificationService { readonly _: unique symbol }
export interface PushNotificationServiceI {
    readonly sendPush: (d: {user_id: string, message: string}) => Effect.Effect<never, never, string>
}
export const PushNotificationService = Context.Tag<PushNotificationService, PushNotificationServiceI>("PushNotificationService")

export const sendPush = invokeFxServiceFn(PushNotificationService, "sendPush")

//////////////////////////////////////////////////////////////////////////////

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
const pureSendWelcomePush = (d: { org: Org, user: User }) => {
    return [{user_id: d.user.id, message: "Welcome " + d.user.name + " of " + d.org.name}] as const
}

const sendPusnNotificationStepSpec =
{
    k: "sendPush" as const,
    inFn: (d: { user_id: string, message: string }) => d,
    svcFn: sendPush
}

// a simple context with an OrgService and a UserService which echo data back
const echoContext = Context.empty().pipe(
    Context.add(OrgService, OrgService.of({
        getById: (id: string) => Effect.succeed({ id: id, name: "Foo" }),
        getByNick: (nick: string) => Effect.succeed({ id: nick, name: "Foo" })
    })),
    Context.add(UserService, UserService.of({
        getByIds: (d: { org_id: string, user_id: string }) => Effect.succeed({ id: d.user_id, name: "Bar" })
    })),
    Context.add(PushNotificationService, PushNotificationService.of({
        sendPush: (d: {user_id: string, message: string}) => Effect.succeed("push sent OK: " + d.message)
    })))


Deno.test("pure effect chain", () => {
    type INPUT = { tag: "INPUT", data: { org_nick: string, user_id: string } }
    const input: INPUT = { tag: "INPUT", data: { org_nick: "foo", user_id: "100" } }

    const pureChainEffect = makePureFnChain<INPUT>()(
        [getOrgObjectStepSpec, getUserObjectStepSpec] as const,
        pureSendWelcomePush,
        [sendPusnNotificationStepSpec] as const)(input)
    
    const prog = Effect.provide(pureChainEffect, echoContext)
    const r = Effect.runSync(prog)

    assertEquals(r, {
        org: { id: "foo", name: "Foo" },
        user: { id: "100", name: "Bar" },
        INPUT: undefined,
        sendPush: "boo"
    })
})
