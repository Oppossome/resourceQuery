import { z } from "zod"

import type { PrototypeCombine, Simplify } from "./types"
import { ResourceManager } from "./manager"

/** Resource
================================= */

export class Resource {
	constructor(...input: any[]) {
		//
	}

	/** Static Methods
	================================= */

	public static resourceManager = new ResourceManager({})

	public static resourceSchema<This extends typeof Resource>(this: This) {
		return z.any().transform((output, ctx) => {
			const parsedOutput = this.resourceManager.schema.safeParse(output)

			if (!parsedOutput.success) {
				parsedOutput.error.issues.forEach(ctx.addIssue)
				return z.NEVER
			}

			return new this(output) as InstanceType<This>
		})
	}

	public static resourceExtend<This extends typeof Resource, NewShape extends z.ZodRawShape>(
		this: This,
		newShape: NewShape
	) {
		type Manager = ResourceManager<This["resourceManager"]["shape"] & NewShape>
		type ManagerOutput = z.infer<Manager["schema"]>
		type PrototypeOutput = PrototypeCombine<This, ManagerOutput>

		// Manually type the extended resourceManager due to weirdness with the generic class parameter
		const resourceManager = this.resourceManager.extend(newShape) as Manager

		return class extends this {
			public static override resourceManager = resourceManager
		} as unknown as Omit<This, "resourceManager" | "prototype"> & {
			new (input: ManagerOutput): PrototypeOutput
			prototype: PrototypeOutput
			resourceManager: Manager
		}
	}
}

class ClassExtension extends Resource.resourceExtend({ test: z.number() }) {
	public get timesTwo() {
		return this.test * 2
	}
}

class SecondClassExtension extends ClassExtension.resourceExtend({ multiplier: z.number() }) {
	public get timesMultiplier() {
		return this.test * this.multiplier
	}

	public get sumTimesTwoTimesMultiplier() {
		return this.timesTwo + this.timesMultiplier
	}
}

const test = z
	.object({
		resource: SecondClassExtension.resourceSchema(),
	})
	.parse({
		resource: {
			test: 2,
			multiplier: 3,
		},
	})

new SecondClassExtension({ test: 3, multiplier: 3 })

console.log(test.resource.sumTimesTwoTimesMultiplier)
