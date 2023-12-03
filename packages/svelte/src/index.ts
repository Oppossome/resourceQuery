import { Resource as CoreResource, QueryResource as CoreQueryResource } from "@resourcequery/core"

import { applySvelteMixin } from "./helpers"

export { uniqueId, updatedOn } from "@resourcequery/core"

export const Resource = applySvelteMixin(CoreResource)

export const QueryResource = applySvelteMixin(CoreQueryResource)

export const query = QueryResource.build.bind(QueryResource)
