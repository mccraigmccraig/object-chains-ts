import { assertEquals } from "assert"
import { Effect, Context } from "effect"
import { ObjectStepSpec } from "./object_builders.ts"
import { Org, User, OrgService, getOrgByNick, User, UserService, getUserByIds, PushNotificationService, sendPush } from "./test_services.ts"
import { tag } from "./tagged.ts"
import { UPObjectChain, ObjectChainsInputTuple, objectChain } from "./object_chain.ts"
import { makeHandlerProgram } from "./handler.ts"

//////////////////// some steps //////////////////////////////////

export const getOrgObjectStepSpec /* : ObjectStepSpec<"org", { data: { org_nick: string } }, string, OrgService, never, Org> */ =
{
    k: "org" as const,
    inFn: (d: { data: { org_nick: string } }) => d.data.org_nick,
    fxFn: getOrgByNick
}
export const getUserObjectStepSpec /* : ObjectStepSpec<"user", { data: { user_id: string }, org: Org }, {org_id: string, user_id: string}, UserService, never, User> */ =
{
    k: "user" as const,
    // note that this fn depends on the output of an OrgServiceI.getBy* step
    inFn: (d: { data: { user_id: string }, org: Org }) => { return { org_id: d.org.id, user_id: d.data.user_id } },
    fxFn: getUserByIds
}

export const pureFormatWelcomePushStepSpec = {
    k: "formatWelcomePush" as const,
    pureFn: (d: { org: Org, user: User }) => {
        return "Welcome " + d.user.name + " of " + d.org.name
    }
}

export const sendPusnNotificationStepSpec =
{
    k: "sendPush" as const,
    inFn: (d: { user: User, formatWelcomePush: string }) => {
        return { user_id: d.user.id, message: d.formatWelcomePush }
    },
    fxFn: sendPush
}

//////////////////////// getOrg

type GetOrgInput = { tag: "GetOrg", data: { org_nick: string } }
const GetOrgInputTag = tag<GetOrgInput>("GetOrg")

const formatOrgOutputStepSpec /* : ObjectStepSpec<"apiResponse", Org, Org, never, never, { org: Org }> */ =
{
    k: "apiResponse" as const,
    inFn: (d: { org: Org }) => d.org,
    fxFn: (d: Org) => Effect.succeed({ org: d })
}

const getOrgProg = objectChain<GetOrgInput>()(
    GetOrgInputTag,
    [getOrgObjectStepSpec,
        formatOrgOutputStepSpec
    ] as const)

//////////////////////// sendWelcomePush

type SendWelcomePushInput = { tag: "SendWelcomePush", data: { org_nick: string, user_id: string } }
const SendWelcomePushInputTag = tag<SendWelcomePushInput>("SendWelcomePush")

const sendWelcomePushProg = objectChain<SendWelcomePushInput>()(
    SendWelcomePushInputTag,
    [getOrgObjectStepSpec,
        getUserObjectStepSpec,
        pureFormatWelcomePushStepSpec,
        sendPusnNotificationStepSpec] as const)


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

////////////////////////// handler ///////////////////////////////////

const programs = [getOrgProg, sendWelcomePushProg] as const

const handlerProgram = makeHandlerProgram(programs)

Deno.test("makeHandlerProgram", () => {
    const getOrgInput: GetOrgInput = { tag: "GetOrg", data: { org_nick: "foo" } }
    const getOrgHandlerEffect = handlerProgram(getOrgInput)
    const getOrgRunnable = Effect.provide(getOrgHandlerEffect, echoContext)
    const getOrgResult = Effect.runSync(getOrgRunnable)

    assertEquals(getOrgResult, {
            ...getOrgInput,
            org: { id: "foo", name: "Foo" },
            apiResponse: { org: { id: "foo", name: "Foo" } }
        })
    
    const sendWelcomePushInput: SendWelcomePushInput = { tag: "SendWelcomePush", data: { org_nick: "foo", user_id: "100" } }
    const sendWelcomePushEffect = handlerProgram(sendWelcomePushInput)
    const sendWelcomePushRunnable = Effect.provide(sendWelcomePushEffect, echoContext)
    const sendWelcomePushResult = Effect.runSync(sendWelcomePushRunnable)

    assertEquals(sendWelcomePushResult, {
        ...sendWelcomePushInput,
        org: { id: "foo", name: "Foo" },
        user: { id: "100", name: "Bar" },
        formatWelcomePush: "Welcome Bar of Foo",
        sendPush: "push sent OK: Welcome Bar of Foo"
        }
    )
})