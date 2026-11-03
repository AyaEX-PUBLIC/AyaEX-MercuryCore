<script lang="ts">
	import { invalidateAll } from "$app/navigation"

	const { data }: { data: import("./$types").PageData } = $props()

	let file = $state<File | null>(null)
	let busy = $state(false)
	let message = $state("")
	let failed = $state(false)

	async function upload(event: SubmitEvent) {
		event.preventDefault()
		if (!file || busy) return

		busy = true
		message = ""
		failed = false
		try {
			const res = await fetch(
				`/place/${data.place.id}/${data.slug}/settings/file`,
				{
					method: "PUT",
					// the route streams the raw file, so it never has to parse
					// a 100MB multipart body before checking its size
					headers: { "Content-Type": "application/octet-stream" },
					body: file,
				}
			)
			const body = await res.json().catch(() => null)
			if (!res.ok) {
				failed = true
				message = body?.message || "Upload failed, try again"
			} else {
				message = "Place file updated"
				file = null
				await invalidateAll()
			}
		} catch {
			failed = true
			message = "Upload failed, try again"
		} finally {
			busy = false
		}
	}
</script>

<form method="post" onsubmit={upload}>
	<div class="pb-6">
		<label for="place-file" class="block pb-2">Place file</label>
		<input
			id="place-file"
			name="file"
			type="file"
			accept=".rbxl"
			onchange={e => (file = e.currentTarget.files?.[0] ?? null)} />
		<small class="formhelp">Up to 100MB. Running servers keep the version they loaded.</small>
	</div>
	<button class="btn btn-primary" disabled={busy || !file}>
		{busy ? "Uploading..." : "<fa fa-save></fa> Save changes"}
	</button>
</form>

{#if message}
	<p class="text-sm pt-2" class:text-red-400={failed} class:text-emerald-400={!failed}>
		{message}
	</p>
{/if}
