import { Resource as BaseResource, Query as BaseQuery } from "@resourcequery/core"

import { applySvelteMixin } from "./helpers"

export { uniqueId, updatedOn } from "@resourcequery/core"

/**
 * Define a query class that extends the CoreResource class.
 */
export const Resource = applySvelteMixin(BaseResource)

export const Query = applySvelteMixin(BaseQuery)
