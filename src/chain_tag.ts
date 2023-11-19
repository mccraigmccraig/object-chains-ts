
export interface ChainTagged {
    readonly _tag: string
}

const chainTagKey: unique symbol = Symbol()

export type ChainTag<T extends ChainTagged> = {
    readonly [chainTagKey]: T['_tag']
}

// build a tag value for a Tagged type,
// forcing the tag param to match the Tagged.tag string
// const aTag = tag<ATagged>("ATagged")
export const chainTag = <T extends ChainTagged>(chainTagStr: T['_tag']): ChainTag<T> => {
    return {
        [chainTagKey]: chainTagStr
    }
}

// get the tag string from a Tag
export const chainTagStr = <T extends ChainTagged>(chainTag: ChainTag<T>): ChainTag<T>[typeof chainTagKey] => {
    return chainTag[chainTagKey]
}