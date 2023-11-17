import { z } from "zod"

import { ResourceManager } from "./manager"
import { ExtendClass } from "./types"

export class Resource {
	constructor(...input: any[]) {
		//
	}

	// === Static ===

	static resourceManager = new ResourceManager({})

	static resourceSchema<This extends typeof Resource>(this: This) {
		return z.unknown().transform((output, ctx) => {
			const parsedOutput = this.resourceManager.schema.safeParse(output)

			if (!parsedOutput.success) {
				parsedOutput.error.issues.forEach(ctx.addIssue)
				return z.NEVER
			}

			return new this(output) as InstanceType<This>
		})
	}

	static resourceExtend<This extends typeof Resource, NewShape extends z.ZodRawShape>(
		this: This,
		newShape: NewShape
	) {
		// Manually type the manager class due to weirdness with the This type
		type Manager = ResourceManager<This["resourceManager"]["shape"] & NewShape>
		type ManagerOutput = z.infer<Manager["schema"]>

		// prettier-ignore
		return class extends this {
			static override resourceManager = super.resourceManager.extend(newShape)
			
		} as ExtendClass<This, {
			new (input: ManagerOutput): This["prototype"] & ManagerOutput
			prototype: This["prototype"] & ManagerOutput
			resourceManager: Manager
		}>
	}
}
