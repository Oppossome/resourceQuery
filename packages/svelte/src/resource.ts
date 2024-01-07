import * as Resource from "@resourcequery/core/src/resource"
import { z } from "zod"

import { applySvelteMixin } from "./helpers"

export * from "@resourcequery/core/src/resource"

export const Class = applySvelteMixin(Resource.Class)

export function resourceExtend<NewShape extends z.ZodRawShape>(shape: NewShape) {
	return Class.resourceExtend(shape)
}
