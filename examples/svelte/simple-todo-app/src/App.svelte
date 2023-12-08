<script lang="ts">
  import Todo from "./lib/todo"

  $: todoQuery = Todo.fetch()
</script>

{JSON.stringify($todoQuery.result)}

{#if $todoQuery.loading}
  <p>Loading...</p>
{/if}

{#if $todoQuery.canLoadMore}
  <button on:click={() => $todoQuery.nextPage()}> Load More </button>
{/if}
