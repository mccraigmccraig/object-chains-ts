import { Effect, Context } from "effect"
import { invokeServiceFxFn } from "./fx_fn.ts"

/////////////////// Org ///////////////////////

export type Org = {
    id: string
    name: string
}
type OrgService = { readonly _: unique symbol }
export interface OrgServiceI {
    readonly getById: (id: string) => Effect.Effect<never, never, Org>
    readonly getByNick: (nick: string) => Effect.Effect<never, never, Org>
}
export const OrgService = Context.Tag<OrgService, OrgServiceI>("OrgService")

// $ExpectType FxFn<string, OrgService, never, Org>
export const getOrgByNick = invokeServiceFxFn(OrgService, "getByNick")


/////////////////// User ///////////////////////

export type User = {
    id: string
    name: string
}
type UserService = { readonly _: unique symbol }
// the service interface
export interface UserServiceI {
    readonly getByIds: (d: { org_id: string, user_id: string }) => Effect.Effect<never, never, User>
}
export const UserService = Context.Tag<UserService, UserServiceI>("UserService")

// $ExpectType FxFn<{org_id: string, user_id: string}, UserService, never, User>
export const getUserByIds = invokeServiceFxFn(UserService, "getByIds")


/////////////////// PushNotification ///////////////////////

type PushNotificationService = { readonly _: unique symbol }
export interface PushNotificationServiceI {
    readonly sendPush: (d: { user_id: string, message: string }) => Effect.Effect<never, never, string>
}
export const PushNotificationService = Context.Tag<PushNotificationService, PushNotificationServiceI>("PushNotificationService")

export const sendPush = invokeServiceFxFn(PushNotificationService, "sendPush")