import { defineConfig } from "vitest/config"

export default defineConfig({
	test: {
		include: ["**/*.test.ts"],
		typecheck: { include: ["**/*.ts"] },
		coverage: {
			provider: "istanbul",
		},
	},
})
