import { z } from "zod"

import { Class as ResourceClass } from "./resource"
import { WeakValueMap } from "./helpers/helpers"

export class ResourceManager<Shape extends z.ZodRawShape> {
	constructor(public shape: Shape) {}

	// === Schema ===

	shapeSchema = z.object(this.shape)

	shapeExtend<NewShape extends z.ZodRawShape>(newShape: NewShape) {
		return new ResourceManager({ ...this.shape, ...newShape })
	}

	// === Storage ===

	resourceStorage = new WeakValueMap<ResourceClass>()
}
