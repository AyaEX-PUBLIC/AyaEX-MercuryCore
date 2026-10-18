<script lang="ts">
	import { onMount } from "svelte"
	import Breadcrumbs from "$components/Breadcrumbs.svelte"
	import Head from "$components/Head.svelte"
	import ShoutMessage from "$components/ShoutMessage.svelte"
	import ShoutText from "$components/ShoutText.svelte"

	const { data } = $props()

	let { shout, channel, moderation, user } = $derived(data)

	let mounted = $state(false)
	onMount(() => (mounted = true))
</script>

<Head
	name={data.siteName}
	title="Message by {shout.author.username} in #{channel.name}" />

<div class="ctnr max-w-200">
	<div class="page-head">
		<div>
			<Breadcrumbs
				path={[["Shoutbox", `/home?channel=${channel.id}`]]}
				final="#{channel.name}" />
			<h1>Message by {shout.author.username}</h1>
		</div>
		<a href="/home?channel={channel.id}" class="btn btn-tertiary">
			<fa fa-messages></fa>
			Open #{channel.name}
		</a>
	</div>

	<section class="panel py-3">
		<ShoutMessage {shout} me={user.username} {mounted} />
	</section>

	{#if moderation}
		<h2 class="text-base pt-8 pb-3">Moderation</h2>
		<section class="panel">
			<dl class="kv">
				<div>
					<dt>Status</dt>
					<dd>
						{#if moderation.deleted}
							<span class="badge badge-danger">
								<fa fa-trash></fa>
								Deleted{moderation.deletedBy
									? ` by ${moderation.deletedBy}`
									: ""}
							</span>
						{:else}
							<span class="badge badge-success">Visible</span>
						{/if}
					</dd>
				</div>
				<div>
					<dt>Earlier versions</dt>
					<dd>{moderation.history.length || "None"}</dd>
				</div>
			</dl>
			{#each moderation.history as body, i}
				<div class="version line-t">
					<div class="eyebrow pb-1">Version {i + 1}</div>
					<ShoutText {body} />
				</div>
			{/each}
		</section>
	{/if}
</div>

<style>
	.version {
		padding: 0.75rem 1rem;
		font-size: 0.875rem;
	}
</style>
