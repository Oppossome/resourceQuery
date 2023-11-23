import { z } from "zod"

import { ResourceManager } from "./manager"
import { ExtendClass } from "./types"

export class Resource {
	constructor(...input: any[]) {
		this.resourceUpdate(input[0])
	}

	/**
	 * The method utilized to update a given resource, when it already exists.
	 * @param input
	 */
	resourceUpdate(input: any) {
		// The most simplistic implementation of this,
		Object.assign(this, input)
	}

	// === Static ===

	static resourceManager = new ResourceManager({})

	static resourceSchema<This extends typeof Resource>(this: This) {
		return this.resourceManager.resourceSchema(this)
	}

	static resourceExtend<This extends typeof Resource, NewShape extends z.ZodRawShape>(
		this: This,
		newShape: NewShape,
	) {
		// Manually type the manager class due to weirdness with the This type
		type Manager = ResourceManager<This["resourceManager"]["shape"] & NewShape>
		type ManagerOutput = z.infer<Manager["shapeSchema"]>

		// prettier-ignore
		return class extends this {
			static override resourceManager = super.resourceManager.shapeExtend(newShape)

		} as ExtendClass<This, {
			new (input: ManagerOutput): This["prototype"] & ManagerOutput 
			prototype: This["prototype"] & ManagerOutput
			resourceManager: Manager
		}>
	}
}

// class PageInfo extends Resource.resourceExtend({
// 	next_page: z.string(),
// }) {
// }

// class Request extends Resource.resourceExtend({

// }) {

// 	public static makeRequest() {

// 	}
// }

// class User extends Resource.resourceExtend({
// 	name: z.string(),
// 	email: z.string().email(),
// }) {

// 	public get displayName() {
// 		return `${this.name} <${this.email}>`
// 	}
// }

// class Post extends Resource.resourceExtend({
// 	message: z.string()
// }) {

// }

// class PostWithUser extends Post.resourceExtend({
// 	user: User.resourceSchema(),
// }) {
// 	public get displayMessage() {
// 		return `${this.user.displayName}: ${this.message}`
// 	}
// }
