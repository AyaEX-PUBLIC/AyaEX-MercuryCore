<script lang="ts">
	import { enhance } from "$app/forms"

	let {
		id,
		pinned = $bindable(false),
		refreshComments
	}: {
		id: string
		pinned?: boolean
		// Replies need to be re-ordered after a reply is pinned or unpinned
		refreshComments: import("@sveltejs/kit").SubmitFunction<any, any>
	} = $props()

	let text = $derived(pinned ? "unpin" : "pin")
</script>

<li>
	<form
		use:enhance={e => {
			pinned = !pinned
			return refreshComments(e)
		}}
		method="post"
		action="/comment/{id}?/pin&set={!pinned}"
		class="inline">
		<button class={["btn", pinned ? "text-red-400" : "text-emerald-400"]}>
			<fa fa-thumbtack></fa>
			{text.charAt(0).toUpperCase() + text.slice(1)}
		</button>
	</form>
</li>
