import { z } from "zod"

import { Resource } from "./resource"

export class ResourceManager<Shape extends z.ZodRawShape> {
	constructor(public shape: Shape) {}

	// === Schema ===

	shapeSchema = z.object(this.shape)

	shapeExtend<NewShape extends z.ZodRawShape>(newShape: NewShape) {
		return new ResourceManager({ ...this.shape, ...newShape })
	}

	// === Storage ===

	resourceStorage = new Map<unknown, WeakRef<Resource>>()
}
