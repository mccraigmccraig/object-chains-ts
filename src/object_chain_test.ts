import { assertEquals } from "assert"
import { Effect } from "effect"
import { chainTag } from "./chain_tag.ts"
import * as cons from "./cons_list.ts"
import {
    objectChain, addStep, makeFxStep, makePureStep,
    concatSteps,
    objectChainFxFn
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
    const chain = objectChain<DoNothing>()(DoNothingTag, steps)

    const input = { _tag: "doNothing" as const }
    const effect = chain.program(input)
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

    const chain = objectChain<SendPushNotification>()(SendPushNotificationTag,
        sendPushNotificationSteps)

    const input: SendPushNotification = {
        _tag: "sendPushNotification" as const,
        data: { org_nick: "foo", user_id: "bar" }
    }
    const effect = chain.program(input)
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

    const ch0 = objectChain<SendPushNotification>()(
        SendPushNotificationTag, cons.None)
    const emptyEffect = ch0.program(input)
    const emptyResult = Effect.runSync(emptyEffect)
    assertEquals(emptyResult, input)

    const ch1 = addStep(ch0, getOrgObjectStepSpec)
    const ch2 = addStep(ch1, getUserObjectStepSpec)
    const ch3 = addStep(ch2, pureFormatPushNotificationStepSpec)
    const sendPushChain = addStep(ch3, sendPusnNotificationStepSpec)

    const sendPushChainEffect = sendPushChain.program(input)
    const sendPushChainRunnable = Effect.provide(sendPushChainEffect,
        testServiceContext)
    const sendPushChainResult = Effect.runSync(sendPushChainRunnable)
    assertEquals(sendPushChainResult, {
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

    const ch0 = objectChain<SendPushNotification>()(
        SendPushNotificationTag, cons.None)

    const ch1 = makeFxStep(ch0,
        "org",
        (d: { data: { org_nick: string } }) => d.data.org_nick,
        getOrgByNick)
    const ch2 = makeFxStep(ch1,
        "user",
        (d: { data: { user_id: string }, org: Org }) => {
            return { org_id: d.org.id, user_id: d.data.user_id }
        },
        getUserByIds)
    const ch3 = makePureStep(ch2,
        "formatPushNotification",
        (d: { org: Org, user: User }) => {
            return "Welcome " + d.user.name + " of " + d.org.name
        }
    )
    const ch4 = makeFxStep(ch3,
        "sendPush",
        (d: { user: User, formatPushNotification: string }) => {
            return { user_id: d.user.id, message: d.formatPushNotification }
        },
        sendPush)

    const sendPushChainEffect = ch4.program(input)

    const sendPushChainRunnable =
        Effect.provide(sendPushChainEffect, testServiceContext)
    const sendPushChainResult = Effect.runSync(sendPushChainRunnable)
    assertEquals(sendPushChainResult, {
        ...input,
        org: { id: "foo", name: "Foo" },
        user: { id: "bar", name: "Bar" },
        formatPushNotification: "Welcome Bar of Foo",
        sendPush: "push sent OK: Welcome Bar of Foo"
    })
})

Deno.test("concatSteps concatenates steps", () => { 
    const firstSteps =
        [getOrgObjectStepSpec,
            [getUserObjectStepSpec,
                cons.None]] as const

    const moreSteps =
        [pureFormatPushNotificationStepSpec,
            [sendPusnNotificationStepSpec, cons.None]] as const

    const shortChain = objectChain<SendPushNotification>()(SendPushNotificationTag,
        firstSteps)
    
    const chain = concatSteps(shortChain, moreSteps)

    const input: SendPushNotification = {
        _tag: "sendPushNotification" as const,
        data: { org_nick: "foo", user_id: "bar" }
    }
    const effect = chain.program(input)
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

Deno.test("composition with RunObjectChainFxFn", () => {
    const chain = objectChain<SendPushNotificationAndGetOrg>()(
        SendPushNotificationAndGetOrgTag,
        sendPushNotificationAndGetOrgSteps)

    const input: SendPushNotificationAndGetOrg = {
        _tag: "sendPushNotificationAndGetOrg" as const,
        data: { org_nick: "foo", user_id: "bar" }
    }
    const effect = chain.program(input)
    const runnable = Effect.provide(effect, testServiceContext)

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

    const ch0 = objectChain<SendPushNotification>()(
        SendPushNotificationTag, cons.None)

    const ch1 = makeFxStep(ch0,
        "org1",
        (d: { data: { org_nick: string } }) => d.data.org_nick,
        getOrgByNick)
    const ch2 = makeFxStep(ch1,
        "org2",
        (d: { data: { org_nick: string } }) => d.data.org_nick,
        getOrgByNick)
    const ch3 = makeFxStep(ch2,
        "org3",
        (d: { data: { org_nick: string } }) => d.data.org_nick,
        getOrgByNick)
    const ch4 = makeFxStep(ch3,
        "org4",
        (d: { data: { org_nick: string } }) => d.data.org_nick,
        getOrgByNick)
    const ch5 = makeFxStep(ch4,
        "org5",
        (d: { data: { org_nick: string } }) => d.data.org_nick,
        getOrgByNick)
    const ch6 = makeFxStep(ch5,
        "org6",
        (d: { data: { org_nick: string } }) => d.data.org_nick,
        getOrgByNick)
    const ch7 = makeFxStep(ch6,
        "org7",
        (d: { data: { org_nick: string } }) => d.data.org_nick,
        getOrgByNick)
    const ch8 = makeFxStep(ch7,
        "org8",
        (d: { data: { org_nick: string } }) => d.data.org_nick,
        getOrgByNick)
    const ch9 = makeFxStep(ch8,
        "org9",
        (d: { data: { org_nick: string } }) => d.data.org_nick,
        getOrgByNick)
    const ch10 = makeFxStep(ch9,
        "org10",
        (d: { data: { org_nick: string } }) => d.data.org_nick,
        getOrgByNick)
    const ch11 = makeFxStep(ch10,
        "org11",
        (d: { data: { org_nick: string } }) => d.data.org_nick,
        getOrgByNick)
    const ch12 = makeFxStep(ch11,
        "org12",
        (d: { data: { org_nick: string } }) => d.data.org_nick,
        getOrgByNick)
    const ch13 = makeFxStep(ch12,
        "org13",
        (d: { data: { org_nick: string } }) => d.data.org_nick,
        getOrgByNick)
    const ch14 = makeFxStep(ch13,
        "org14",
        (d: { data: { org_nick: string } }) => d.data.org_nick,
        getOrgByNick)
    const ch15 = makeFxStep(ch14,
        "org15",
        (d: { data: { org_nick: string } }) => d.data.org_nick,
        getOrgByNick)
    const ch16 = makeFxStep(ch15,
        "org16",
        (d: { data: { org_nick: string } }) => d.data.org_nick,
        getOrgByNick)
    const ch17 = makeFxStep(ch16,
        "org17",
        (d: { data: { org_nick: string } }) => d.data.org_nick,
        getOrgByNick)
    const ch18 = makeFxStep(ch17,
        "org18",
        (d: { data: { org_nick: string } }) => d.data.org_nick,
        getOrgByNick)
    const ch19 = makeFxStep(ch18,
        "org19",
        (d: { data: { org_nick: string } }) => d.data.org_nick,
        getOrgByNick)
    const ch20 = makeFxStep(ch19,
        "org20",
        (d: { data: { org_nick: string } }) => d.data.org_nick,
        getOrgByNick)

    const effect = ch20.program(input)

    const runnable =
        Effect.provide(effect, testServiceContext)
    const r = Effect.runSync(runnable)
    assertEquals(r, {
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