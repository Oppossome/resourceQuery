<script lang="ts">
  import Todo from "./lib/todo"

  $: todoQuery = Todo.fetch()
</script>

{JSON.stringify($todoQuery.result)}

<button on:click={() => $todoQuery.nextPage()}> Load More </button>
