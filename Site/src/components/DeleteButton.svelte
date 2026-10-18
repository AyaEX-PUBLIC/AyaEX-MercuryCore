<script lang="ts">
	import { enhance } from "$app/forms"
	import { refreshComments } from "$lib/refreshComments"

	const {
		id,
		moderate = false
	}: {
		id: string
		moderate?: boolean
	} = $props()

	let text = $derived(moderate ? "remove" : "delete")
</script>

<li>
	<form
		use:enhance={refreshComments}
		method="post"
		action="/comment/{id}?/delete&action={text}"
		class="inline">
		<button class={["btn", moderate ? "text-cyan-400" : "text-amber-400"]}>
			<fa class={moderate ? "fa-gavel" : "fa-trash"}></fa>
			{text.charAt(0).toUpperCase() + text.slice(1)}
		</button>
	</form>
</li>
