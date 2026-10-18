<script lang="ts">
	import { enhance } from "$app/forms"
	import { page } from "$app/state"
	import Head from "$components/Head.svelte"

	const { data, form } = $props()

	let busy = $state(false)
	let copied = $state("")

	const date = (d: Date | string) => new Date(d).toLocaleDateString()
	const link = (code: string) =>
		`${page.url.origin}/register?invite=${encodeURIComponent(code)}`

	function inviteState(invite: (typeof data.invites)[number]) {
		if (invite.usedBy.length) return ["used", `Used by ${invite.usedBy.join(", ")}`]
		if (invite.usesLeft < 1) return ["off", "Disabled"]
		if (invite.expiry && new Date(invite.expiry) < new Date())
			return ["off", "Expired"]
		return ["open", invite.expiry ? `Unused, until ${date(invite.expiry)}` : "Unused"]
	}

	async function copy(code: string) {
		try {
			await navigator.clipboard.writeText(link(code))
			copied = code
		} catch {}
	}

	let invitees = $derived(data.invites.flatMap(i => i.usedBy))
	const kinds: { [_: string]: string } = {
		purchase: "bought invite",
		application: "approved application"
	}
</script>

<Head name={data.siteName} title="Invites" />

<div class="ctnr">
	<div class="page-head">
		<div>
			<div class="eyebrow">You</div>
			<h1>Invites</h1>
			<p>
				{#if data.registration === "invite"}
					{data.siteName} is invite-only. Give an invite to someone
					you trust: who invited whom is recorded.
				{:else if data.registration === "open"}
					Registration is open right now, so nobody needs an invite.
				{:else}
					Registration is closed right now.
				{/if}
			</p>
		</div>
	</div>

	<div class="grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[20rem_minmax(0,1fr)] gap-6 items-start">
		<div class="flex flex-col gap-6">
			<section class="panel">
				<div class="panel-head">Your place in the tree</div>
				<dl class="kv">
					<div>
						<dt>Invited by</dt>
						<dd>
							{#if data.inviter?.username}
								<a href="/user/{data.inviter.username}">{data.inviter.username}</a>
							{:else}
								<span class="grey-text">Nobody</span>
							{/if}
						</dd>
					</div>
					{#if data.inviter?.kind}
						<div>
							<dt>Through</dt>
							<dd>{kinds[data.inviter.kind] || data.inviter.kind}</dd>
						</div>
					{/if}
					<div>
						<dt>You invited</dt>
						<dd>{invitees.length} {invitees.length === 1 ? "person" : "people"}</dd>
					</div>
				</dl>
				{#if invitees.length}
					<div class="flex flex-wrap gap-2 px-4 pb-4">
						{#each invitees as name}
							<a href="/user/{name}" class="badge">{name}</a>
						{/each}
					</div>
				{/if}
			</section>

			{#if data.purchase.enabled}
				<section class="panel">
					<div class="panel-head">Buy an invite</div>
					<div class="p-4">
						<div class="price">
							{#if data.purchase.price}
								<span class="grey-text">{data.currencySymbol}</span>
								{data.purchase.price}
							{:else}
								Free
							{/if}
						</div>
						<p class="grey-text text-sm pt-2">
							{data.purchase.left} of {data.perUserWeekly} left for you this
							week{#if data.purchase.siteLeft !== null}, and {data.purchase.siteLeft}
								for everyone{/if}. Resets {date(data.purchase.resets)}.
							{#if data.expiryDays}
								Invites expire {data.expiryDays} days after you buy them.
							{/if}
						</p>
						<form
							method="post"
							action="?/buy"
							use:enhance={() => {
								busy = true
								return async ({ update }) => {
									await update()
									busy = false
								}
							}}>
							<button class="btn btn-primary w-full mt-3" disabled={busy || !!data.purchase.reason}>
								{busy ? "Buying..." : "Buy an invite"}
							</button>
						</form>
						{#if data.purchase.reason}
							<p class="text-sm grey-text pt-2">{data.purchase.reason}.</p>
						{/if}
						{#if form?.error}
							<p class="text-sm text-red-400 pt-2">{form.error}</p>
						{:else if form?.bought}
							<p class="text-sm text-emerald-400 pt-2">
								Bought! It's at the top of your invites.
							</p>
						{/if}
					</div>
				</section>
			{/if}
		</div>

		<section class="panel min-w-0">
			<div class="panel-head">
				<span>Your invites</span>
				<span>{data.invites.length}</span>
			</div>
			{#if data.invites.length}
				<ul class="invites">
					{#each data.invites as invite (invite.id)}
						{@const [kind, label] = inviteState(invite)}
						<li>
							<div class="min-w-0">
								<div class="mono code">{invite.code}</div>
								<div class="text-xs grey-text pt-1">
									{label} &middot; made {date(invite.created)}
								</div>
							</div>
							{#if kind === "open"}
								<button type="button" class="btn btn-sm btn-tertiary" onclick={() => copy(invite.code)}>
									<fa fa-copy></fa>
									{copied === invite.code ? "Copied" : "Copy link"}
								</button>
							{:else}
								<span class={["badge", { "badge-success": kind === "used" }]}>
									{kind === "used" ? "Used" : "Closed"}
								</span>
							{/if}
						</li>
					{/each}
				</ul>
			{:else}
				<div class="empty m-4">
					<b>No invites yet</b>
					<p>
						{data.purchase.enabled
							? "Buy one to bring a friend."
							: "Staff can give invites out."}
					</p>
				</div>
			{/if}
		</section>
	</div>
</div>

<style>
	.price {
		font-size: 1.75rem;
		font-weight: 600;
		line-height: 1;
	}

	.invites {
		margin: 0;
		padding: 0;
		list-style: none;
		& li {
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 1rem;
			padding: 0.75rem 1rem;
			& + li {
				border-top: 1px solid var(--accent2);
			}
		}
		& .code {
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
			font-size: 0.875rem;
		}
	}
</style>
