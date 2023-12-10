import App from "./App.svelte"

import makeServer from "./server"
import "./main.css"

makeServer()

export default new App({
	target: document.getElementById("app")!,
})
