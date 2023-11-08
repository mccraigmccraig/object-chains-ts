import { assertEquals } from "assert"
import { Effect, Context } from "effect"
import { invokeFxServiceFn } from "./fx_service_fn.ts"

export type Org = {
    id: string
    name: string
}
interface OrgService { readonly _: unique symbol }
export interface OrgServiceI {
    readonly getById: (id: string) => Effect.Effect<never, never, Org>
    readonly getByNick: (nick: string) => Effect.Effect<never, never, Org>
}
export const OrgService = Context.Tag<OrgService, OrgServiceI>("OrgService")

// $ExpectType FxServiceFn<string, OrgService, never, Org>
export const getOrgByNick = invokeFxServiceFn(OrgService, "getByNick")

const context = Context.empty().pipe(
    Context.add(OrgService, OrgService.of({
        getById: (id: string) => Effect.succeed({ id: id, name: id.toString() }),
        getByNick: (nick: string) => Effect.succeed({ id: nick, name: nick })
    })))

const prog = Effect.gen(function* (_) {
    const org = yield* _(getOrgByNick("foo"))
    return org;
})

Deno.test("invokeFxServiceFn retrieves the service and invokes the FxServiceFn", () => {
    // provide Service impls
    const runnable = Effect.provide(prog, context)
    // run the program
    const r = Effect.runSync(runnable)

    assertEquals(r, { id: "foo", name: "foo" })
})
