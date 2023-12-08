<script lang="ts">
  import type Todo from "./lib/todo"

  export let todo: Todo
</script>

<div>
  <input
    type="checkbox"
    checked={$todo.completed}
    on:click|preventDefault={() => todo.patch({ completed: !todo.completed })}
  />
  <span>{$todo.summary}</span>
</div>
