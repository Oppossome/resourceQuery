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
	plugins: ["@typescript-eslint", "prettier"],
	overrides: [
		{
			env: { node: true },
			files: [".eslintrc.{js,cjs}"],
			parserOptions: { sourceType: "script" },
		},
	],
	rules: {
		"prettier/prettier": "error",
		"linebreak-style": ["error", "unix"],
		"@typescript-eslint/no-explicit-any": "off",
		"@typescript-eslint/ban-types": "off",
		"import/no-unresolved": "off",
		"import/order": [
			"error",
			{
				groups: [["builtin", "external"], "internal", ["parent", "sibling", "index"]],
			},
		],
	},
}
