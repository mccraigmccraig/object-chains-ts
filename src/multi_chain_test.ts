import { assertEquals } from "assert"
import { Effect, Context } from "effect"
import { Org, OrgService, getOrgByNick, User, UserService, getUserByIds, PushNotificationService, sendPush } from "./test_services.ts"
import { chainTag } from "./chain_tag.ts"
import { objectChain } from "./object_chain.ts"
import { multiChainProgram, multiChain, addChains } from "./multi_chain.ts"

//////////////////// some steps //////////////////////////////////

const getOrgObjectStepSpec = {
    k: "org" as const,
    inFn: (d: { data: { org_nick: string } }) => d.data.org_nick,
    fxFn: getOrgByNick
}
const getUserObjectStepSpec = {
    k: "user" as const,
    // note that this fn depends on the output of an OrgServiceI.getBy* step
    inFn: (d: { data: { user_id: string }, org: Org }) => { return { org_id: d.org.id, user_id: d.data.user_id } },
    fxFn: getUserByIds
}

const pureFormatWelcomePushStepSpec = {
    k: "formatWelcomePush" as const,
    pureFn: (d: { org: Org, user: User }) => {
        return "Welcome " + d.user.name + " of " + d.org.name
    }
}

const sendPusnNotificationStepSpec = {
    k: "sendPush" as const,
    inFn: (d: { user: User, formatWelcomePush: string }) => {
        return { user_id: d.user.id, message: d.formatWelcomePush }
    },
    fxFn: sendPush
}

const pureFormatOrgOutputStepSpec = {
    k: "apiResponse" as const,
    pureFn: (d: { org: Org }) => { return { org: d.org } }
}

//////////////////////// getOrg chain

type GetOrgInput = { _chainTag: "GetOrg", data: { org_nick: string } }
const GetOrgInputTag = chainTag<GetOrgInput>("GetOrg")


const getOrgProg = objectChain<GetOrgInput>()(
    GetOrgInputTag,
    [getOrgObjectStepSpec,
        pureFormatOrgOutputStepSpec
    ] as const)

//////////////////////// sendWelcomePush chain

type SendWelcomePushInput = { _chainTag: "SendWelcomePush", data: { org_nick: string, user_id: string } }
const SendWelcomePushInputTag = chainTag<SendWelcomePushInput>("SendWelcomePush")

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

////////////////////////// multiChain for getOrg and sendWelcomePush

const programs = [getOrgProg, sendWelcomePushProg] as const

const prog = multiChainProgram(programs)

Deno.test("multiChainProgram runs chains", () => {
    const getOrgInput: GetOrgInput = { _chainTag: "GetOrg", data: { org_nick: "foo" } }

    // note the inferred Effect value type selects the output of the getOrg chain
    const getOrgEffect = prog(getOrgInput)
    const getOrgRunnable = Effect.provide(getOrgEffect, echoContext)
    const getOrgResult = Effect.runSync(getOrgRunnable)

    assertEquals(getOrgResult, {
        ...getOrgInput,
        org: { id: "foo", name: "Foo" },
        apiResponse: { org: { id: "foo", name: "Foo" } }
    })

    const sendWelcomePushInput: SendWelcomePushInput = { _chainTag: "SendWelcomePush", data: { org_nick: "foo", user_id: "100" } }

    // note the inferred Effect value type selects the output of the sendWelcomePush chain
    const sendWelcomePushEffect = prog(sendWelcomePushInput)
    const sendWelcomePushRunnable = Effect.provide(sendWelcomePushEffect, echoContext)
    const sendWelcomePushResult = Effect.runSync(sendWelcomePushRunnable)

    assertEquals(sendWelcomePushResult, {
        ...sendWelcomePushInput,
        org: { id: "foo", name: "Foo" },
        user: { id: "100", name: "Bar" },
        formatWelcomePush: "Welcome Bar of Foo",
        sendPush: "push sent OK: Welcome Bar of Foo"
    })
})

Deno.test("multiChain runs chains", () => {
    const mc = multiChain(programs)

    const getOrgInput: GetOrgInput = { _chainTag: "GetOrg", data: { org_nick: "foo" } }

    // note the inferred Effect value type selects the output of the getOrg chain
    const getOrgEffect = mc.program(getOrgInput)
    const getOrgRunnable = Effect.provide(getOrgEffect, echoContext)
    const getOrgResult = Effect.runSync(getOrgRunnable)

    assertEquals(getOrgResult, {
        ...getOrgInput,
        org: { id: "foo", name: "Foo" },
        apiResponse: { org: { id: "foo", name: "Foo" } }
    })
})

Deno.test("addChains adds to a multiChain", () => {
    const emptyMultiChain = multiChain([])
    const mc = addChains(emptyMultiChain, programs)

    const getOrgInput: GetOrgInput = { _chainTag: "GetOrg", data: { org_nick: "foo" } }

    // note the inferred Effect value type selects the output of the getOrg chain
    const getOrgEffect = mc.program(getOrgInput)
    const getOrgRunnable = Effect.provide(getOrgEffect, echoContext)
    const getOrgResult = Effect.runSync(getOrgRunnable)

    assertEquals(getOrgResult, {
        ...getOrgInput,
        org: { id: "foo", name: "Foo" },
        apiResponse: { org: { id: "foo", name: "Foo" } }
    })
})