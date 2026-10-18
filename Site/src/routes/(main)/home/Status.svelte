<script lang="ts">
	import User from "$components/User.svelte"

	const { status }: { status: import("./$types").PageData["feed"][number] } =
		$props()

	let hidden = $derived(status.visibility !== "Visible")
</script>

<article class={["status", { "opacity-40": hidden }]}>
	<User user={status.author} size="2.5rem" class="self-start" />
	<div class="min-w-0 flex-1">
		<div class="flex items-baseline justify-between gap-3">
			<a
				href="/user/{status.author.username}"
				class="light-text text-sm font-600 truncate">
				{status.author.username}
			</a>
			<time class="eyebrow normal-case tracking-normal shrink-0">
				{status.created.toLocaleString()}
			</time>
		</div>
		<a href="/comment/{status.id}" class="content light-text">
			{status.currentContent}
		</a>
		{#if status.pinned || status.replies > 0}
			<div class="flex gap-3 pt-2">
				{#if status.pinned}
					<span class="badge badge-success">
						<fa fa-thumbtack></fa>
						Pinned
					</span>
				{/if}
				{#if status.replies > 0}
					<span class="badge">
						<fa fa-message></fa>
						{status.replies}
					</span>
				{/if}
			</div>
		{/if}
	</div>
</article>

<style>
	.status {
		display: flex;
		gap: 0.875rem;
		padding: 1rem 1.25rem;
		transition: background-color 0.15s;
		&:hover {
			background: var(--accent);
		}
	}

	.content {
		display: block;
		padding-top: 0.25rem;
		overflow-wrap: anywhere;
		white-space: pre-line;
		&:hover {
			color: var(--light-text) !important;
		}
	}
</style>
