import { assertEquals } from "assert"
import { Effect, Context } from "effect"
import { ObjectStepSpec } from "./object_builders.ts"
import { Org, OrgService, getOrgByNick, User, UserService, getUserByIds, PushNotificationService, sendPush } from "./test_services.ts"
import { tag, pureWrapperProgram, pureWrapperChainProgram } from "./pure_wrapper.ts"
import { makeHandlerProgram } from "./handler.ts"

//////////////////// some steps //////////////////////////////////

export const getOrgObjectStepSpec /* : ObjectStepSpec<"org", { data: { org_nick: string } }, string, OrgService, never, Org> */ =
{
    k: "org" as const,
    inFn: (d: { data: { org_nick: string } }) => d.data.org_nick,
    svcFn: getOrgByNick
}
export const getUserObjectStepSpec /* : ObjectStepSpec<"user", { data: { user_id: string }, org: Org }, {org_id: string, user_id: string}, UserService, never, User> */ =
{
    k: "user" as const,
    // note that this fn depends on the output of an OrgServiceI.getBy* step
    inFn: (d: { data: { user_id: string }, org: Org }) => { return { org_id: d.org.id, user_id: d.data.user_id } },
    svcFn: getUserByIds
}

export const pureSendWelcomePush = (d: { org: Org, user: User }) => {
    return [{
        user_id: d.user.id,
        message: "Welcome " + d.user.name + " of " + d.org.name
    }] as const
}

export const sendPusnNotificationStepSpec =
{
    k: "sendPush" as const,
    inFn: (d: { user_id: string, message: string }) => d,
    svcFn: sendPush
}

//////////////////////// getOrg

type GetOrgInput = { tag: "GetOrg", data: { org_nick: string } }
const GetOrgInputTag = tag<GetOrgInput>("GetOrg")

const formatOrgOutputStepSpec: ObjectStepSpec<"apiResponse", Org, Org, never, never, {org: Org}> = 
{
    k: "apiResponse" as const,
    inFn: (d: Org) => d,
    svcFn: (d: Org) => Effect.succeed({org: d})
}

const getOrgProg = pureWrapperChainProgram<GetOrgInput>()(
    GetOrgInputTag,
    [getOrgObjectStepSpec] as const,
    (d: { org: Org }) => [d.org] as const,
    [formatOrgOutputStepSpec] as const)

//////////////////////// sendWelcomePush

type SendWelcomePushInput = { tag: "SendWelcomePush", data: { org_nick: string, user_id: string } }
const SendWelcomePushInputTag = tag<SendWelcomePushInput>("SendWelcomePush")

const sendWelcomePushInputFn = (i: SendWelcomePushInput) => {
    return Effect.succeed({
        ...i,
        org: { id: "foo", name: "Foo" },
        user: { id: "100", name: "Bar" } })
}

const sendWelcomePushOutputFn = (d: readonly [{ user_id: string, message: string }]) => {
    return Effect.succeed({sendPush: "push sent OK: " + d[0].user_id.toString() + ", " + d[0].message})
}

const sendWelcomePushProg = pureWrapperProgram<SendWelcomePushInput>()(SendWelcomePushInputTag,
    sendWelcomePushInputFn,
    pureSendWelcomePush,
    sendWelcomePushOutputFn)


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

////////////////////////// handler ///////////////////////////////////

const programs = [getOrgProg, sendWelcomePushProg]

const handlerProgram = makeHandlerProgram(programs)

Deno.test("makeHandlerProgram", () => {
    const getOrgInput: GetOrgInput = { tag: "GetOrg", data: { org_nick: "foo"} }
//    const sendWelcomePushInput: SendWelcomePushInput = { tag: "SendWelcomePush", data: { org_nick: "foo", user_id: "100" } }
    
    const handlerEffect = handlerProgram(getOrgInput)
    const runnable = Effect.provide(handlerEffect, echoContext)
    const r = Effect.runSync(runnable)

    assertEquals(r,
        {
            ...getOrgInput,
            org: { id: "foo", name: "Foo" },
            GetOrg: [{id: "foo", name: "Foo"}],
            apiResponse: {org: {id: "foo", name: "Foo"}}
        })
})