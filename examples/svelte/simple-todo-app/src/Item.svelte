<script lang="ts">
  import { v4 as uuid } from "uuid"
  import type Todo from "./lib/todo"

  export let todo: Todo
  const fieldId = uuid()
</script>

<div>
  <input
    id={fieldId}
    type="checkbox"
    checked={$todo.completed}
    on:click|preventDefault={() => todo.patch({ completed: !todo.completed })}
  />
  <label for={fieldId}>{$todo.summary}</label>
</div>
