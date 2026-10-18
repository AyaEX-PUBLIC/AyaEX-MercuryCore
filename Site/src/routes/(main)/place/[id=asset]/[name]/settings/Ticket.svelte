<script lang="ts">
	import { page } from "$app/state"
	import { superForm } from "$lib/validate"

	const { data }: { data: import("./$types").PageData } = $props()

	let { message, enhance, delayed } = $derived(superForm(data.ticketForm, {
		id: "ticket"
	}))
</script>

<form use:enhance method="post" action="?/ticket&tab=Network">
	<fieldset class="pb-6">
		<label for="ticket" class="block pb-2">Server ticket</label>
		<div>
			<div class="input-group">
				<input
					id="ticket"
					required
					value={data.serverTicket}
					disabled />
				<button
					class="btn btn-{$message && page.status === 200
						? 'success'
						: 'secondary'}">
					<fa fa-rotate></fa>
					{#if $delayed}
						Working...
					{:else}
						{$message || "Regenerate"}
					{/if}
				</button>
			</div>
			<small class="formhelp">
				The server ticket is required to host servers on {data.siteName}.
				You can regenerate the ticket at any time.
			</small>
		</div>
	</fieldset>
</form>
