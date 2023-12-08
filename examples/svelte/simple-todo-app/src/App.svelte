<script lang="ts">
  import Todo from "./lib/todo"
  import Item from "./Item.svelte"

  $: todoQuery = Todo.fetch()
</script>

{#each $todoQuery.result?.todos ?? [] as todo}
  <Item {todo} />
{/each}

{#if $todoQuery.loading}
  <p>Loading...</p>
{/if}

<button on:click={() => $todoQuery.nextPage()}> Load More </button>
