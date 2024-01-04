import { Query, Resource } from "@resourcequery/svelte"
import { z } from "zod"

export class PaginatedQuery<
	Schema extends z.ZodSchema<{ next_page?: number }>,
> extends Query.Class<Schema> {
	public get canLoadMore() {
		return !this.loading && this.result?.next_page !== undefined
	}

	public nextPage() {
		if (!this.result?.next_page) return // No next page or occupied
		this.invalidate()
	}

	static override defineQuery<Schema extends z.ZodSchema>(options: Query.Options<Schema>) {
		return new PaginatedQuery<Schema>(options)
	}
}

type PatchTodo = Partial<Resource.input<typeof Todo>> & { id: string }

export default class Todo extends Resource.resourceExtend({
	id: Resource.uniqueId(z.string()),
	completed: z.boolean(),
	text: z.string(),
}) {
	get summary() {
		return `${this.text} ${this.completed ? "✔" : "❌"}`
	}

	patch(input: Omit<PatchTodo, "id">) {
		return Todo.patch({ ...input, id: this.id })
	}

	static patch(update: PatchTodo) {
		return PaginatedQuery.defineQuery({
			schema: z.object({ todo: Todo.resourceSchema() }),
			query: async function (schema) {
				const response = await fetch(`/api/todos`, {
					body: JSON.stringify(update),
					method: "PATCH",
				})

				return schema.parse(await response.json())
			},
		})
	}

	static fetch() {
		return PaginatedQuery.defineQuery({
			schema: z.object({
				todos: z.array(Todo.resourceSchema()),
				next_page: z.number().optional(),
			}),
			query: async function (schema) {
				const response = await fetch(`/api/todos?pageOffset=${this.result?.next_page ?? 0}`)
				const result = schema.parse(await response.json())
				if (!this.result) return result

				return {
					...result,
					todos: [...this.result.todos, ...result.todos],
				}
			},
		})
	}
}
