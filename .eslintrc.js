module.exports = {
	parser: "@typescript-eslint/parser",
	parserOptions: {
		ecmaVersion: "latest",
		sourceType: "module",
	},
	env: {
		browser: true,
		es2021: true,
		node: true,
	},
	extends: [
		"eslint:recommended",
		"plugin:@typescript-eslint/recommended",
		"plugin:import/recommended",
	],
	plugins: ["@typescript-eslint"],
	overrides: [
		{
			env: { node: true },
			files: [".eslintrc.{js,cjs}"],
			parserOptions: { sourceType: "script" },
		},
	],
	rules: {
		"@typescript-eslint/no-namespace": "off",
		"@typescript-eslint/no-explicit-any": "off",
		"@typescript-eslint/ban-types": "off",
		"import/no-unresolved": "off",
		"import/order": [
			"error",
			{
				"newlines-between": "always",
				groups: [["builtin", "external"], "internal", ["parent", "sibling", "index"]],
			},
		],
		"no-unused-vars": "off",
		"@typescript-eslint/no-unused-vars": [
			"error",
			{
				argsIgnorePattern: "^_",
				varsIgnorePattern: "^_",
				caughtErrorsIgnorePattern: "^_",
			},
		],
	},
}
