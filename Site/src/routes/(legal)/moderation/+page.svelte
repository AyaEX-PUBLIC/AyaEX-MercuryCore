<script lang="ts">
	import { enhance } from "$app/forms"
	import Head from "$components/Head.svelte"

	const { data } = $props()

	const moderationAction: { [_: string]: string } = {
		Warning: "Warning",
		Ban: "Ban",
		Termination: "Termination"
	}
	let actionType = $derived(moderationAction[data.type])

	const s = (n: number) => (n > 1 ? "s" : "")
	function formatDateDiff(date: number) {
		const millisDiff = Math.round(date - Date.now())
		if (millisDiff < 0) return "0 minutes" // lmao

		const daysDiff = Math.floor(millisDiff / 86400e3)
		if (daysDiff >= 1) return `${daysDiff} day${s(daysDiff)}`

		const hoursDiff = Math.floor(millisDiff / 3600e3)
		const minsDiff = Math.floor((millisDiff % 3600e3) / 60e3)
		const mins = `${minsDiff} minute${s(minsDiff)}`
		if (hoursDiff < 1) return mins
		return `${hoursDiff} hour${s(hoursDiff)} ${mins}`
	}
</script>

<Head name={data.siteName} title={actionType} />

<div class="ctnr max-w-200">
	<section class="panel notice">
		<div class="panel-head">
			<span>Account {actionType === "Termination" ? "terminated" : "notice"}</span>
		</div>
		<div class="p-6">
			<h1 class="pb-6">
				{actionType === "Ban"
					? `${actionType}ned for ${formatDateDiff(
							new Date(data.timeEnds).getTime()
						)}`
					: actionType}
			</h1>

			<p class="grey-text">
				Our moderators have determined that your behaviour has violated
				the {data.siteName} Terms of Service.
			</p>

			<dl class="kv panel my-6">
				<div>
					<dt>Reviewed</dt>
					<dd>{new Date(data.time).toLocaleString()}</dd>
				</div>
				<div>
					<dt>Moderator note</dt>
					<dd>{data.note}</dd>
				</div>
			</dl>

			{#if actionType === "Warning"}
				<p class="grey-text">
					Please make sure to follow the {data.siteName} Terms of Service
					to prevent further action being taken on your account.
				</p>
				<p class="grey-text">
					You may reactivate your account if you agree to follow our
					Terms of Service.
				</p>
				<form use:enhance method="post">
					<button class="btn btn-primary">Reactivate</button>
				</form>
			{:else if actionType === "Ban"}
				{@const ended = new Date(data.timeEnds).getTime() < Date.now()}
				<p class="grey-text">
					Please make sure to follow the {data.siteName} Terms of Service
					to prevent further action being taken on your account.
				</p>
				<p class="grey-text">
					You may reactivate your account after your ban ends in {formatDateDiff(
						new Date(data.timeEnds).getTime()
					)} if you agree to follow our Terms of Service.
				</p>
				<form use:enhance method="post">
					<button
						class={[
							"btn btn-primary",
							{ "pointer-events-none": !ended }
						]}
						disabled={!ended}>
						Reactivate
					</button>
				</form>
			{:else}
				<p class="grey-text">You may not reactivate your account.</p>
			{/if}
		</div>
	</section>
</div>

<style>
	.notice {
		border-top: 2px solid var(--danger);
	}
</style>
