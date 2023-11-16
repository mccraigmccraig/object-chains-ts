
export interface Tagged {
    readonly tag: string
}

const tagKey: unique symbol = Symbol()

export type Tag<T extends Tagged> = {
    readonly [tagKey]: T['tag']
}

// build a tag value for a Tagged type,
// forcing the tag param to match the Tagged.tag string
// const aTag = tag<ATagged>("ATagged")
export const tag = <T extends Tagged>(tag: T['tag']): Tag<T> => {
    return {
        [tagKey]: tag
    }
}

// get the tag string from a Tag
export const tagStr = <T extends Tagged>(tag: Tag<T>): Tag<T>[typeof tagKey] => {
    return tag[tagKey]
}