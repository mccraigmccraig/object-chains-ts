
export interface ChainTagged {
    readonly _tag: string
}

const chainTagKey: unique symbol = Symbol()

export type ChainTag<T extends ChainTagged> = {
    readonly [chainTagKey]: T['_tag']
}

// build a tag value for a Tagged type,
// forcing the tag param to match the ChainTagged._tag string
// const aChainTag = chainTag<AChainTagged>("AChainTagged")
export const chainTag =
    <T extends ChainTagged>(tag: T['_tag']): ChainTag<T> => {
        return {
            [chainTagKey]: tag
        }
    }

// get the tag string from a ChainTag
export const tag =
    <T extends ChainTagged>(chainTag: ChainTag<T>)
        : ChainTag<T>[typeof chainTagKey] => {

        return chainTag[chainTagKey]
    }