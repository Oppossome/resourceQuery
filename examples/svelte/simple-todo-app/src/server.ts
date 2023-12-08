import { Server } from "miragejs"
import { v4 as uuid } from "uuid"

declare global {
	interface Window {
		server: Server
	}
}

export default function makeServer() {
	return (window.server = new Server({
		environment: "development",
		seeds(server) {
			server.db.loadData({
				todos: Array.from({ length: 25 }).map((_, i) => ({
					id: uuid(),
					text: `Todo ${i + 1}`,
					completed: false,
				})),
			})
		},
		routes() {
			this.namespace = "api"
			this.timing = 1000

			this.get("/todos", ({ db }, request) => {
				const pageOffset = Number(request.queryParams.pageOffset) || 0
				const todoItems: any[] = []

				for (let i = 0; i < 5; i++) {
					if (!db.todos[i + pageOffset]) break
					todoItems.push(db.todos[i + pageOffset])
				}

				return db.todos.length > pageOffset + 5
					? { todos: todoItems, next_page: pageOffset + 5 }
					: { todos: todoItems }
			})

			this.patch("/todos/:id", (schema, request) => {
				const todo = JSON.parse(request.requestBody).data
				return schema.db.todos.update(todo.id, todo)
			})

			this.post("/todos", (schema, request) => {
				const todo = JSON.parse(request.requestBody).data
				return schema.db.todos.insert(todo)
			})
		},
	}))
}
