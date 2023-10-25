import { Effect, Context } from "npm:effect@^2.0.0-next.44"
import { FxService, handleEventProgram } from "./handler_chain.ts";

export interface Event {    
    readonly tag: string
}

export interface HandleEventFxService<V,R,E> extends FxService<V,Event,R,E> {
    readonly fx: (ev?: Event) => Effect.Effect<R,E,V>
}