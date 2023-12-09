import { assertEquals } from "assert"
import { Effect } from "effect"
import { chainTag } from "./chain_tag.ts"
import * as cons from "./cons.ts"
import {
    objectChain, addFxStep, makeFxStep,
    addPureStep, makePureStep,
    objectChainFxFn, provideObjectChainServiceImpl
} from "./object_chain.ts"
import {
    Org, getOrgByNick, User, getUserByIds, sendPush,
    testServiceContext
} from "./test_services.ts"

const getOrgObjectStepSpec =
{
    k: "org" as const,
    inFn: (d: { data: { org_nick: string } }) => d.data.org_nick,
    fxFn: getOrgByNick
}
const getUserObjectStepSpec =
{
    k: "user" as const,
    // note that this fn depends on the output of an OrgServiceI.getBy* step
    inFn: (d: { data: { user_id: string }, org: Org }) => {
        return { org_id: d.org.id, user_id: d.data.user_id }
    },
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

Deno.test("empty objectChain returns input", () => {
    type DoNothing = { readonly _tag: "doNothing" }
    const DoNothingTag = chainTag<DoNothing>("doNothing")

    const steps = cons.None
    const prog = objectChain<DoNothing>()(DoNothingTag, steps)

    const input = { _tag: "doNothing" as const }
    const effect = prog.program(input)
    const r = Effect.runSync(effect)

    assertEquals(r, { _tag: "doNothing" })
})

type SendPushNotification = {
    readonly _tag: "sendPushNotification",
    readonly data: { org_nick: string, user_id: string }
}
const SendPushNotificationTag =
    chainTag<SendPushNotification>("sendPushNotification")

const sendPushNotificationSteps =
    [getOrgObjectStepSpec,
        [getUserObjectStepSpec,
            [pureFormatPushNotificationStepSpec,
                [sendPusnNotificationStepSpec, cons.None]]]] as const

Deno.test("objectChain mixes fx and pure steps", () => {

    const prog = objectChain<SendPushNotification>()(SendPushNotificationTag,
        sendPushNotificationSteps)

    const input: SendPushNotification = {
        _tag: "sendPushNotification" as const,
        data: { org_nick: "foo", user_id: "bar" }
    }
    const effect = prog.program(input)
    const runnable = Effect.provide(effect, testServiceContext)
    const r = Effect.runSync(runnable)

    assertEquals(r, {
        ...input,
        org: { id: "foo", name: "Foo" },
        user: { id: "bar", name: "Bar" },
        formatPushNotification: "Welcome Bar of Foo",
        sendPush: "push sent OK: Welcome Bar of Foo"
    })
})

Deno.test("addStep lets you add steps", () => {
    const input: SendPushNotification = {
        _tag: "sendPushNotification" as const,
        data: { org_nick: "foo", user_id: "bar" }
    }

    const p0 = objectChain<SendPushNotification>()(
        SendPushNotificationTag, cons.None)
    const emptyEffect = p0.program(input)
    const emptyResult = Effect.runSync(emptyEffect)
    assertEquals(emptyResult, input)

    const p1 = addFxStep(p0, getOrgObjectStepSpec)
    const p2 = addFxStep(p1, getUserObjectStepSpec)
    const p3 = addPureStep(p2, pureFormatPushNotificationStepSpec)
    const sendPushProg = addFxStep(p3, sendPusnNotificationStepSpec)

    const sendPushProgEffect = sendPushProg.program(input)
    const sendPushProgRunnable = Effect.provide(sendPushProgEffect,
        testServiceContext)
    const sendPushProgResult = Effect.runSync(sendPushProgRunnable)
    assertEquals(sendPushProgResult, {
        ...input,
        org: { id: "foo", name: "Foo" },
        user: { id: "bar", name: "Bar" },
        formatPushNotification: "Welcome Bar of Foo",
        sendPush: "push sent OK: Welcome Bar of Foo"
    })
})

Deno.test("makeFxStep and makePureStep add steps", () => {
    const input: SendPushNotification = {
        _tag: "sendPushNotification" as const,
        data: { org_nick: "foo", user_id: "bar" }
    }

    const p0 = objectChain<SendPushNotification>()(
        SendPushNotificationTag, cons.None)

    const p1 = makeFxStep(p0,
        "org",
        (d: { data: { org_nick: string } }) => d.data.org_nick,
        getOrgByNick)
    const p2 = makeFxStep(p1,
        "user",
        (d: { data: { user_id: string }, org: Org }) => {
            return { org_id: d.org.id, user_id: d.data.user_id }
        },
        getUserByIds)
    const p3 = makePureStep(p2,
        "formatPushNotification",
        (d: { org: Org, user: User }) => {
            return "Welcome " + d.user.name + " of " + d.org.name
        }
    )
    const p4 = makeFxStep(p3,
        "sendPush",
        (d: { user: User, formatPushNotification: string }) => {
            return { user_id: d.user.id, message: d.formatPushNotification }
        },
        sendPush)

    const sendPushProgEffect = p4.program(input)

    const sendPushProgRunnable =
        Effect.provide(sendPushProgEffect, testServiceContext)
    const sendPushProgResult = Effect.runSync(sendPushProgRunnable)
    assertEquals(sendPushProgResult, {
        ...input,
        org: { id: "foo", name: "Foo" },
        user: { id: "bar", name: "Bar" },
        formatPushNotification: "Welcome Bar of Foo",
        sendPush: "push sent OK: Welcome Bar of Foo"
    })
})

// make a getOrg chain which can be run as a step
type GetOrg = {
    readonly _tag: "getOrg",
    readonly data: { org_nick: string }
}
const GetOrgTag = chainTag<GetOrg>("getOrg")
const getOrgSteps = [getOrgObjectStepSpec, cons.None] as const
const getOrgChain = objectChain<GetOrg>()(GetOrgTag, getOrgSteps)

const runGetOrgChainStepspec =
{
    k: "runGetOrgChain" as const,
    inFn: (d: { data: { org_nick: string } }) => {
        return {
            _tag: "getOrg" as const,
            data: { org_nick: d.data.org_nick }
        }
    },
    fxFn: objectChainFxFn(getOrgChain)
}

type SendPushNotificationAndGetOrg = {
    readonly _tag: "sendPushNotificationAndGetOrg",
    readonly data: { org_nick: string, user_id: string }
}
const SendPushNotificationAndGetOrgTag =
    chainTag<SendPushNotificationAndGetOrg>("sendPushNotificationAndGetOrg")

const sendPushNotificationAndGetOrgSteps =
    [getOrgObjectStepSpec,
        [getUserObjectStepSpec,
            [pureFormatPushNotificationStepSpec,
                [sendPusnNotificationStepSpec,
                    [runGetOrgChainStepspec,
                        cons.None]]]]] as const

Deno.test("recursion with RunObjectChainFxFn", () => {
    const prog = objectChain<SendPushNotificationAndGetOrg>()(
        SendPushNotificationAndGetOrgTag,
        sendPushNotificationAndGetOrgSteps)

    const input: SendPushNotificationAndGetOrg = {
        _tag: "sendPushNotificationAndGetOrg" as const,
        data: { org_nick: "foo", user_id: "bar" }
    }
    const effect = prog.program(input)
    const almostRunnable = Effect.provide(effect, testServiceContext)
    const runnable = provideObjectChainServiceImpl(almostRunnable, getOrgChain)

    const r = Effect.runSync(runnable)

    assertEquals(r, {
        ...input,
        org: { id: "foo", name: "Foo" },
        user: { id: "bar", name: "Bar" },
        formatPushNotification: "Welcome Bar of Foo",
        sendPush: "push sent OK: Welcome Bar of Foo",
        runGetOrgChain: {
            _tag: "getOrg",
            data: { org_nick: "foo" },
            org: { id: "foo", name: "Foo" }
        }
    })
})

Deno.test("a longer chain", () => {
    const input: SendPushNotification = {
        _tag: "sendPushNotification" as const,
        data: { org_nick: "foo", user_id: "bar" }
    }

    const p0 = objectChain<SendPushNotification>()(
        SendPushNotificationTag, cons.None)

    const p1 = makeFxStep(p0,
        "org1",
        (d: { data: { org_nick: string } }) => d.data.org_nick,
        getOrgByNick)
    const p2 = makeFxStep(p1,
        "org2",
        (d: { data: { org_nick: string } }) => d.data.org_nick,
        getOrgByNick)
    const p3 = makeFxStep(p2,
        "org3",
        (d: { data: { org_nick: string } }) => d.data.org_nick,
        getOrgByNick)
    const p4 = makeFxStep(p3,
        "org4",
        (d: { data: { org_nick: string } }) => d.data.org_nick,
        getOrgByNick)
    const p5 = makeFxStep(p4,
        "org5",
        (d: { data: { org_nick: string } }) => d.data.org_nick,
        getOrgByNick)
    const p6 = makeFxStep(p5,
        "org6",
        (d: { data: { org_nick: string } }) => d.data.org_nick,
        getOrgByNick)
    const p7 = makeFxStep(p6,
        "org7",
        (d: { data: { org_nick: string } }) => d.data.org_nick,
        getOrgByNick)
    const p8 = makeFxStep(p7,
        "org8",
        (d: { data: { org_nick: string } }) => d.data.org_nick,
        getOrgByNick)
    const p9 = makeFxStep(p8,
        "org9",
        (d: { data: { org_nick: string } }) => d.data.org_nick,
        getOrgByNick)
    const p10 = makeFxStep(p9,
        "org10",
        (d: { data: { org_nick: string } }) => d.data.org_nick,
        getOrgByNick)
    const p11 = makeFxStep(p10,
        "org11",
        (d: { data: { org_nick: string } }) => d.data.org_nick,
        getOrgByNick)
    const p12 = makeFxStep(p11,
        "org12",
        (d: { data: { org_nick: string } }) => d.data.org_nick,
        getOrgByNick)
    const p13 = makeFxStep(p12,
        "org13",
        (d: { data: { org_nick: string } }) => d.data.org_nick,
        getOrgByNick)
    const p14 = makeFxStep(p13,
        "org14",
        (d: { data: { org_nick: string } }) => d.data.org_nick,
        getOrgByNick)
    const p15 = makeFxStep(p14,
        "org15",
        (d: { data: { org_nick: string } }) => d.data.org_nick,
        getOrgByNick)
    const p16 = makeFxStep(p15,
        "org16",
        (d: { data: { org_nick: string } }) => d.data.org_nick,
        getOrgByNick)
    const p17 = makeFxStep(p16,
        "org17",
        (d: { data: { org_nick: string } }) => d.data.org_nick,
        getOrgByNick)
    const p18 = makeFxStep(p17,
        "org18",
        (d: { data: { org_nick: string } }) => d.data.org_nick,
        getOrgByNick)
    const p19 = makeFxStep(p18,
        "org19",
        (d: { data: { org_nick: string } }) => d.data.org_nick,
        getOrgByNick)
    const p20 = makeFxStep(p19,
        "org20",
        (d: { data: { org_nick: string } }) => d.data.org_nick,
        getOrgByNick)

    const sendPushProgEffect = p20.program(input)

    const sendPushProgRunnable =
        Effect.provide(sendPushProgEffect, testServiceContext)
    const sendPushProgResult = Effect.runSync(sendPushProgRunnable)
    assertEquals(sendPushProgResult, {
        ...input,
        org1: { id: "foo", name: "Foo" },
        org2: { id: "foo", name: "Foo" },
        org3: { id: "foo", name: "Foo" },
        org4: { id: "foo", name: "Foo" },
        org5: { id: "foo", name: "Foo" },
        org6: { id: "foo", name: "Foo" },
        org7: { id: "foo", name: "Foo" },
        org8: { id: "foo", name: "Foo" },
        org9: { id: "foo", name: "Foo" },
        org10: { id: "foo", name: "Foo" },
        org11: { id: "foo", name: "Foo" },
        org12: { id: "foo", name: "Foo" },
        org13: { id: "foo", name: "Foo" },
        org14: { id: "foo", name: "Foo" },
        org15: { id: "foo", name: "Foo" },
        org16: { id: "foo", name: "Foo" },
        org17: { id: "foo", name: "Foo" },
        org18: { id: "foo", name: "Foo" },
        org19: { id: "foo", name: "Foo" },
        org20: { id: "foo", name: "Foo" },
    })

})