import { assertEquals } from "assert"
import { Effect } from "effect"
import { chainTag } from "./chain_tag.ts"
import { objectChain, addSteps, addStep, addFxStep, addPureStep, objectChainFxFn, provideObjectChainServiceImpl } from "./object_chain.ts"
import { Org, getOrgByNick, User, getUserByIds, sendPush, testServiceContext } from "./test_services.ts"

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

Deno.test("empty objectChain returns input", () => {
    type DoNothing = { readonly _tag: "doNothing" }
    const DoNothingTag = chainTag<DoNothing>("doNothing")

    const steps = [] as const
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
const SendPushNotificationTag = chainTag<SendPushNotification>("sendPushNotification")

const sendPushNotificationSteps = [getOrgObjectStepSpec,
    getUserObjectStepSpec,
    pureFormatPushNotificationStepSpec,
    sendPusnNotificationStepSpec] as const

Deno.test("objectChain mixes fx and pure steps", () => {

    const prog = objectChain<SendPushNotification>()(SendPushNotificationTag, sendPushNotificationSteps)

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

Deno.test("addSteps lets you add steps", () => {
    const input: SendPushNotification = {
        _tag: "sendPushNotification" as const,
        data: { org_nick: "foo", user_id: "bar" }
    }

    const emptyProg = objectChain<SendPushNotification>()(SendPushNotificationTag, [])
    const emptyEffect = emptyProg.program(input)
    const emptyResult = Effect.runSync(emptyEffect)
    assertEquals(emptyResult, input)

    const sendPushProg = addSteps(emptyProg, sendPushNotificationSteps)
    const sendPushProgEffect = sendPushProg.program(input)
    const sendPushProgRunnable = Effect.provide(sendPushProgEffect, testServiceContext)
    const sendPushProgResult = Effect.runSync(sendPushProgRunnable)
    assertEquals(sendPushProgResult, {
        ...input,
        org: { id: "foo", name: "Foo" },
        user: { id: "bar", name: "Bar" },
        formatPushNotification: "Welcome Bar of Foo",
        sendPush: "push sent OK: Welcome Bar of Foo"
    })
})

Deno.test("addStep lets you add a single step", () => {
    const input: SendPushNotification = {
        _tag: "sendPushNotification" as const,
        data: { org_nick: "foo", user_id: "bar" }
    }

    const shortProg = objectChain<SendPushNotification>()(SendPushNotificationTag,
        sendPushNotificationSteps.slice(0, 3))
    const sendPushProg = addStep(shortProg, sendPushNotificationSteps[3])
    const sendPushProgEffect = sendPushProg.program(input)
    const sendPushProgRunnable = Effect.provide(sendPushProgEffect, testServiceContext)
    const sendPushProgResult = Effect.runSync(sendPushProgRunnable)
    assertEquals(sendPushProgResult, {
        ...input,
        org: { id: "foo", name: "Foo" },
        user: { id: "bar", name: "Bar" },
        formatPushNotification: "Welcome Bar of Foo",
        sendPush: "push sent OK: Welcome Bar of Foo"
    })
})

Deno.test("addFxStep and addPureStep add steps", () => {
    const input: SendPushNotification = {
        _tag: "sendPushNotification" as const,
        data: { org_nick: "foo", user_id: "bar" }
    }

    const noSteps = objectChain<SendPushNotification>()(SendPushNotificationTag, [])

    const oneStep = addFxStep(noSteps,
        "org",
        (d: { data: { org_nick: string } }) => d.data.org_nick,
        getOrgByNick)
    const twoSteps = addFxStep(oneStep,
        "user",
        (d: { data: { user_id: string }, org: Org }) => { return { org_id: d.org.id, user_id: d.data.user_id } },
        getUserByIds)
    const threeSteps = addPureStep(twoSteps,
        "formatPushNotification",
        (d: { org: Org, user: User }) => { return "Welcome " + d.user.name + " of " + d.org.name }
    )
    // const sendPushProg = addFxStep(threeSteps,
    //     "sendPush",
    //     (d: { user: User, formatPushNotification: string }) => {
    //         return { user_id: d.user.id, message: d.formatPushNotification }
    //     },
    //     sendPush)

    const sendPushProgEffect = threeSteps.program(input)
    // four steps is enough to trigger the "Type instantiation is excessively deep and possibly infinite" error
    // so it seems the combination of iterative additions and inference over a list causes a
    // combinatorial explosion
    // const fourStepsEffect = sendPushProg.program(input)
    
    // i think this is because the depth is  M + 2M + 3M + 4M = M(N+1)/2 = O(N^2)
    // because each step has inference depth M, and a new array is created in each step

    const sendPushProgRunnable = Effect.provide(sendPushProgEffect, testServiceContext)
    const sendPushProgResult = Effect.runSync(sendPushProgRunnable)
    assertEquals(sendPushProgResult, {
        ...input,
        org: { id: "foo", name: "Foo" },
        user: { id: "bar", name: "Bar" },
        formatPushNotification: "Welcome Bar of Foo",
        // sendPush: "push sent OK: Welcome Bar of Foo"
    })
})

type GetOrg = {
    readonly _tag: "getOrg",
    readonly data: { org_nick: string }
}
const GetOrgTag = chainTag<GetOrg>("getOrg")
const getOrgSteps = [getOrgObjectStepSpec] as const
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
const SendPushNotificationAndGetOrgTag = chainTag<SendPushNotificationAndGetOrg>("sendPushNotificationAndGetOrg")

const sendPushNotificationAndGetOrgSteps = [
    getOrgObjectStepSpec,
    getUserObjectStepSpec,
    pureFormatPushNotificationStepSpec,
    sendPusnNotificationStepSpec,
    runGetOrgChainStepspec] as const

Deno.test("recursion with RunObjectChainFxFn", () => {
    const prog = objectChain<SendPushNotificationAndGetOrg>()(SendPushNotificationAndGetOrgTag, sendPushNotificationAndGetOrgSteps)

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