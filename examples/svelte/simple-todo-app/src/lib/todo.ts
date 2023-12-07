import { Resource, Query, uniqueId } from "@resourcequery/svelte"
import { z } from "zod"

export default class TodoItem extends Resource.resourceExtend({
	id: uniqueId(z.string().uuid()),
	text: z.string(),
	completed: z.boolean(),
}) {
	static fetch(pageOffset: number = 0) {
		return new Query({
			query: async () => {
				const response = await fetch(`/api/todos?pageOffset=${pageOffset}`)

				return z
					.object({
						todos: z.array(TodoItem.resourceSchema()),
						next_page: z.number().nullable(),
					})
					.parse(await response.json())
			},
		})
	}
}
