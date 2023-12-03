import { Resource as CoreResource, query as CoreQuery } from "@resourcequery/core"

import { applySvelteMixin } from "./helpers"

export const Resource = applySvelteMixin(CoreResource)
