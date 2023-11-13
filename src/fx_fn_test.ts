import { assertEquals } from "assert"
import { Effect, Context } from "effect"
import {OrgService, getOrgByNick} from "./test_services.ts"


const context = Context.empty().pipe(
    Context.add(OrgService, OrgService.of({
        getById: (id: string) => Effect.succeed({ id: id, name: id.toString() }),
        getByNick: (nick: string) => Effect.succeed({ id: nick, name: nick })
    })))

const prog = Effect.gen(function* (_) {
    const org = yield* _(getOrgByNick("foo"))
    return org;
})

Deno.test("invokeServiceFxFn retrieves the service and invokes the FxFn", () => {

    const runnable = Effect.provide(prog, context)

    const r = Effect.runSync(runnable)

    assertEquals(r, { id: "foo", name: "foo" })
})
