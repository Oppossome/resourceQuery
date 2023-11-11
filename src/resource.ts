import { z } from "zod"

export class Resource {
	public constructor(input: any) {
		Object.assign(this, input)
	}

	/**
	 * Static Methods
	 */

	public static _resourceRawSchema = z.object({})

	public static resourceSchema<This extends typeof Resource>(this: This) {
		return this._resourceRawSchema.transform((object) => {
			return new this(object) as InstanceType<This>
		})
	}

	public static resourceExtend<This extends typeof Resource, Shape extends z.ZodRawShape>(
		this: This,
		shape: Shape
	) {
		const extendedShape = this._resourceRawSchema.merge(z.object(shape))

		// @ts-expect-error - Typescript thinks this is a mixin
		return class extends this {
			public static override _resourceRawSchema = extendedShape
		} as ExtendedResource<This, typeof extendedShape>
	}
}

// prettier-ignore
type ExtendedResource<
	T extends typeof Resource, 
	Schema extends z.AnyZodObject
> = Omit<T,"new" | "_resourceRawSchema"> & {
	new (input: z.infer<Schema>): InstanceType<T> & z.infer<Schema>
	_resourceRawSchema: Schema
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

console.log(test.resource.sumTimesTwoTimesMultiplier)
