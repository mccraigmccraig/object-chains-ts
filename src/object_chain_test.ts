import { assertEquals } from "assert"
import { Effect, Context } from "effect"
import { tag } from "./tagged.ts"
import { objectChain, addSteps } from "./object_chain.ts"
import { Org, OrgService, getOrgByNick, User, UserService, getUserByIds, PushNotificationService, sendPush } from "./test_services.ts"

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

const pureFormatPushNotificationStepSpec = {
    k: "formatPushNotification" as const,
    pureFn: (d: { org: Org, user: User }) => {
        return "Welcome " + d.user.name + " of " + d.org.name 
    }
}

const sendPusnNotificationStepSpec =
{
    k: "sendPush" as const,
    inFn: (d: { user: User, formatPushNotification: string }) => {
        return {
            user_id: d.user.id,
            message: d.formatPushNotification
        }
    },
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
        sendPush: (d: { user_id: string, message: string }) => Effect.succeed("push sent OK: " + d.message)
    })))

Deno.test("empty objectChain returns input", () => {
    type DoNothing = { readonly tag: "doNothing" }
    const DoNothingTag = tag<DoNothing>("doNothing")

    const steps = [] as const
    const prog = objectChain<DoNothing>()(DoNothingTag, steps)

    const input = { tag: "doNothing" as const}
    const effect = prog.program(input)
    const r = Effect.runSync(effect)

    assertEquals(r, {tag: "doNothing"})
})

type SendPushNotification = {
    readonly tag: "sendPushNotification",
    readonly data: { org_nick: string, user_id: string }
}
const SendPushNotificationTag = tag<SendPushNotification>("sendPushNotification")

const sendPushNotificationSteps = [getOrgObjectStepSpec,
    getUserObjectStepSpec,
    pureFormatPushNotificationStepSpec,
    sendPusnNotificationStepSpec] as const

Deno.test("objectChain mixes fx and pure steps", () => {

    const prog = objectChain<SendPushNotification>()(SendPushNotificationTag, sendPushNotificationSteps)

    const input: SendPushNotification = {
        tag: "sendPushNotification" as const,
        data: {org_nick: "foo", user_id: "bar"}
    }
    const effect = prog.program(input)
    const runnable = Effect.provide(effect, echoContext)
    const r = Effect.runSync(runnable)

    assertEquals(r, {
        ...input,
        org: { id: "foo", name: "Foo" },
        user: {id: "bar", name: "Bar" },
        formatPushNotification: "Welcome Bar of Foo",
        sendPush: "push sent OK: Welcome Bar of Foo"
    })
})

Deno.test("addSteps lets you add steps", () => {
    const input: SendPushNotification = {
        tag: "sendPushNotification" as const,
        data: { org_nick: "foo", user_id: "bar" }
    }

    const emptyProg = objectChain<SendPushNotification>()(SendPushNotificationTag, [])
    const emptyEffect = emptyProg.program(input)
    const emptyResult = Effect.runSync(emptyEffect)
    assertEquals(emptyResult, input)

    const sendPushProg = addSteps(emptyProg, sendPushNotificationSteps)
    const sendPushProgEffect = sendPushProg.program(input)
    const sendPushProgRunnable = Effect.provide(sendPushProgEffect, echoContext)
    const sendPushProgResult = Effect.runSync(sendPushProgRunnable)
    assertEquals(sendPushProgResult, {
        ...input,
        org: { id: "foo", name: "Foo" },
        user: { id: "bar", name: "Bar" },
        formatPushNotification: "Welcome Bar of Foo",
        sendPush: "push sent OK: Welcome Bar of Foo"
    })
})

Deno.test("recursion with RunObjectChainFxFn", () => {
    
})