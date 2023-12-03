<script lang="ts">
  import { Question } from "./resources/question"

  const query = Question.fetch()
</script>

{JSON.stringify($query.result)}
