<script lang="ts">
  import TodoItem from "./lib/todo"

  $: todoQuery = TodoItem.fetch(5)
</script>

{JSON.stringify($todoQuery.result)}

<button on:click={() => $todoQuery.nextPage()}> Load More </button>
