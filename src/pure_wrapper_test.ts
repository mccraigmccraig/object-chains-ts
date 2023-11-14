import { assertEquals } from "assert"
import { Effect, Context } from "effect"
import { wrapPure, wrapPureChain } from "./pure_wrapper.ts"
import {Org, OrgService, getOrgByNick, User, UserService, getUserByIds, PushNotificationService, sendPush} from "./test_services.ts"

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

const pureSendWelcomePush = (d: { org: Org, user: User }) => {
    return [{user_id: d.user.id, message: "Welcome " + d.user.name + " of " + d.org.name}] as const
}

const sendPusnNotificationStepSpec =
{
    k: "sendPush" as const,
    inFn: (d: { user_id: string, message: string }) => d,
    fxFn: sendPush
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

Deno.test("wrapPureFn", () => {
    type INPUT = { tag: "sendWelcomePush", data: { org_nick: string, user_id: string } }
    const input: INPUT = { tag: "sendWelcomePush", data: { org_nick: "foo", user_id: "100" } }

    const inputFn = (i: INPUT) => {
        return Effect.succeed({
            ...i,
            org: { id: "foo", name: "Foo" },
            user: { id: "100", name: "Bar" } })
    }

    const outputFn = (_d: readonly [{ user_id: string, message: string }]) => {
        return Effect.succeed({sendPush: "push sent OK: Welcome Bar of Foo"})
    }

    const prog = wrapPure<INPUT>()(inputFn, pureSendWelcomePush, outputFn)(input)
    const r = Effect.runSync(prog)
    assertEquals(r, {
        ...input,
        org: { id: "foo", name: "Foo" },
        user: { id: "100", name: "Bar" },
        sendWelcomePush: [{user_id: "100", message: "Welcome Bar of Foo"}],
        sendPush: "push sent OK: Welcome Bar of Foo"
    })
})

Deno.test("wrapPureChain", () => {
    type INPUT = { tag: "sendWelcomePush", data: { org_nick: string, user_id: string } }
    const input: INPUT = { tag: "sendWelcomePush", data: { org_nick: "foo", user_id: "100" } }
    
    const pureChainProg = wrapPureChain<INPUT>()(
        [getOrgObjectStepSpec, getUserObjectStepSpec] as const,
        pureSendWelcomePush,
        [sendPusnNotificationStepSpec] as const)
    
    const pureChainEffect = pureChainProg(input)
    const runnable = Effect.provide(pureChainEffect, echoContext)
    const r = Effect.runSync(runnable)

    assertEquals(r, {
        ...input,
        org: { id: "foo", name: "Foo" },
        user: { id: "100", name: "Bar" },
        sendWelcomePush: [{user_id: "100", message: "Welcome Bar of Foo"}],
        sendPush: "push sent OK: Welcome Bar of Foo"
    })
})

