import { assertEquals } from "assert"
import { Effect } from "effect"
import {
    Org, getOrgByNick, User, getUserByIds, changeUser, sendPush,
    testServiceContext
} from "./test_services.ts"
import { chainTag } from "./chain_tag.ts"
import { objectChain, objectChainFxFn } from "./object_chain.ts"
import {
    multiChainProgram, multiChain, addChains,
    multiChainServicesContext
} from "./multi_chain.ts"

//////////////////// some steps //////////////////////////////////

const getOrgObjectStepSpec = {
    k: "org" as const,
    inFn: (d: { data: { org_nick: string } }) => d.data.org_nick,
    fxFn: getOrgByNick
}
const getUserObjectStepSpec = {
    k: "user" as const,
    // note that this fn depends on the output of an OrgServiceI.getBy* step
    inFn: (d: { data: { user_id: string }, org: Org }) => {
        return { org_id: d.org.id, user_id: d.data.user_id }
    },
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

type GetOrgInput = { _tag: "GetOrg", data: { org_nick: string } }
const GetOrgInputTag = chainTag<GetOrgInput>("GetOrg")


const getOrgProg = objectChain<GetOrgInput>()(
    GetOrgInputTag,
    [getOrgObjectStepSpec,
        pureFormatOrgOutputStepSpec
    ] as const)

//////////////////////// sendWelcomePush chain

type SendWelcomePushInput = {
    _tag: "SendWelcomePush",
    data: { org_nick: string, user_id: string }
}
const SendWelcomePushInputTag =
    chainTag<SendWelcomePushInput>("SendWelcomePush")

const sendWelcomePushProg = objectChain<SendWelcomePushInput>()(
    SendWelcomePushInputTag,
    [getOrgObjectStepSpec,
        getUserObjectStepSpec,
        pureFormatWelcomePushStepSpec,
        sendPusnNotificationStepSpec] as const)


////////////////////////// multiChain for getOrg and sendWelcomePush

Deno.test("multiChainProgram runs chains", () => {
    const prog = multiChainProgram([getOrgProg, sendWelcomePushProg])

    const getOrgInput: GetOrgInput = {
        _tag: "GetOrg",
        data: { org_nick: "foo" }
    }

    // note the inferred Effect value type selects the output of the getOrg
    // chain
    const getOrgEffect = prog(getOrgInput)
    const getOrgRunnable = Effect.provide(getOrgEffect, testServiceContext)
    const getOrgResult = Effect.runSync(getOrgRunnable)

    assertEquals(getOrgResult, {
        ...getOrgInput,
        org: { id: "foo", name: "Foo" },
        apiResponse: { org: { id: "foo", name: "Foo" } }
    })

    const sendWelcomePushInput: SendWelcomePushInput = {
        _tag: "SendWelcomePush",
        data: { org_nick: "foo", user_id: "100" }
    }

    // note the inferred Effect value type selects the output of the 
    // sendWelcomePush chain
    const sendWelcomePushEffect = prog(sendWelcomePushInput)
    const sendWelcomePushRunnable =
        Effect.provide(sendWelcomePushEffect, testServiceContext)
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
    const mc = multiChain([getOrgProg, sendWelcomePushProg])

    const getOrgInput: GetOrgInput = {
        _tag: "GetOrg",
        data: { org_nick: "foo" }
    }

    // note the inferred Effect value type selects the output of the 
    // getOrg chain
    const getOrgEffect = mc.program(getOrgInput)
    const getOrgRunnable = Effect.provide(getOrgEffect, testServiceContext)

    const getOrgResult = Effect.runSync(getOrgRunnable)

    assertEquals(getOrgResult, {
        ...getOrgInput,
        org: { id: "foo", name: "Foo" },
        apiResponse: { org: { id: "foo", name: "Foo" } }
    })

    const sendWelcomePushInput: SendWelcomePushInput = {
        _tag: "SendWelcomePush",
        data: { org_nick: "foo", user_id: "100" }
    }

    // note the inferred Effect value type selects the output of the 
    // sendWelcomePush chain
    const sendWelcomePushEffect = mc.program(sendWelcomePushInput)
    const sendWelcomePushRunnable =
        Effect.provide(sendWelcomePushEffect, testServiceContext)
    const sendWelcomePushResult = Effect.runSync(sendWelcomePushRunnable)

    assertEquals(sendWelcomePushResult, {
        ...sendWelcomePushInput,
        org: { id: "foo", name: "Foo" },
        user: { id: "100", name: "Bar" },
        formatWelcomePush: "Welcome Bar of Foo",
        sendPush: "push sent OK: Welcome Bar of Foo"
    })
})

Deno.test("addChains adds to a multiChain", () => {
    const emptyMultiChain = multiChain([])
    const mc = addChains(emptyMultiChain, [getOrgProg, sendWelcomePushProg])

    const getOrgInput: GetOrgInput = {
        _tag: "GetOrg",
        data: { org_nick: "foo" }
    }

    // note the inferred Effect value type selects the output of the 
    // getOrg chain
    const getOrgEffect = mc.program(getOrgInput)
    const getOrgRunnable = Effect.provide(getOrgEffect, testServiceContext)
    const getOrgResult = Effect.runSync(getOrgRunnable)

    assertEquals(getOrgResult, {
        ...getOrgInput,
        org: { id: "foo", name: "Foo" },
        apiResponse: { org: { id: "foo", name: "Foo" } }
    })
})

type ChangeUserSetWelcomeSent = {
    readonly _tag: "ChangeUserSetWelcomeSent"
    readonly user: User
}
const changeUserSetWelcomeSentStepSpec = {
    k: "changeUserSetWelcomeSent" as const,
    inFn: (d: { user: User }) => {
        return {
            old: d.user,
            new: { ...d.user, welcomeSent: true }
        }
    },
    fxFn: changeUser
}
const ChangeUserSetWelcomeSentTag =
    chainTag<ChangeUserSetWelcomeSent>("ChangeUserSetWelcomeSent")
const changeUserSetWelcomeSentSteps =
    [changeUserSetWelcomeSentStepSpec] as const
const changeUserSetWelcomeSentChain = objectChain<ChangeUserSetWelcomeSent>()(
    ChangeUserSetWelcomeSentTag,
    changeUserSetWelcomeSentSteps)

const runChangeUserSetWelcomeSentChainStepSpec = {
    k: "runChangeUserSetWelcomeSentChain" as const,
    inFn: (d: { user: User }) => {
        return {
            _tag: "ChangeUserSetWelcomeSent" as const,
            user: d.user
        }
    },
    fxFn: objectChainFxFn(changeUserSetWelcomeSentChain)
}
type SendWelcomePushAndUpdateUser = {
    readonly _tag: "SendWelcomePushAndUpdateUser",
    readonly data: { org_nick: string, user_id: string }
}
const SendWelcomePushAndUpdateUser =
    chainTag<SendWelcomePushAndUpdateUser>("SendWelcomePushAndUpdateUser")
const sendWelcomePushAndUpdateUserSteps = [
    getOrgObjectStepSpec,
    getUserObjectStepSpec,
    pureFormatWelcomePushStepSpec,
    sendPusnNotificationStepSpec,
    runChangeUserSetWelcomeSentChainStepSpec
] as const

const sendWelcomePushAndUpdateUserStepsChain =
    objectChain<SendWelcomePushAndUpdateUser>()(
        SendWelcomePushAndUpdateUser,
        sendWelcomePushAndUpdateUserSteps
    )

Deno.test("recursion with multiChainServicesContext", () => {
    // both the directly invoked chain and the 
    // recursively invoked chain must be in the 
    // MultiChain
    const mc = multiChain([
        getOrgProg,
        sendWelcomePushProg,
        sendWelcomePushAndUpdateUserStepsChain,
        changeUserSetWelcomeSentChain
    ])

    const input: SendWelcomePushAndUpdateUser = {
        _tag: "SendWelcomePushAndUpdateUser",
        data: { org_nick: "foo", user_id: "100" }
    }

    const prog = mc.program(input)
    const almostRunnable = Effect.provide(prog, testServiceContext)
    const runnable = Effect.provide(almostRunnable,
        multiChainServicesContext(mc))

    const r = Effect.runSync(runnable)

    assertEquals(r, {
        ...input,
        org: { id: "foo", name: "Foo" },
        user: { id: "100", name: "Bar" },
        formatWelcomePush: "Welcome Bar of Foo",
        sendPush: "push sent OK: Welcome Bar of Foo",
        runChangeUserSetWelcomeSentChain: {
            _tag: "ChangeUserSetWelcomeSent",
            user: { id: "100", name: "Bar" },
            changeUserSetWelcomeSent: {
                id: "100",
                name: "Bar",
                welcomeSent: true
            }
        }
    })
})