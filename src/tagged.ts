export interface Tagged { readonly tag: string }
export type Tag<T extends Tagged> = { readonly tag: T['tag'] }

// build a tag value for an Tagged type,
// forcing the tag param to match the Tagged.tag string
// const aTag = tag<ATagged>("ATagged")
export const tag = <T extends Tagged>(tag: T['tag']): Tag<T> => { return { tag } }
