<script lang="ts">
	// The code is in the URL fragment (#...), which browsers never send to
	// the server, and is posted to /api/apply to look the application up
	import { onMount } from "svelte"
	import Head from "$components/Head.svelte"
	import LoginShell from "../../LoginShell.svelte"

	const { data } = $props()

	type Status = {
		username: string
		created: string
		status: "pending" | "approved" | "rejected"
		note: string
		invite: { code: string; expiry?: string; used: boolean } | null
	}

	let status: Status | null = $state(null)
	let error = $state("")
	let loading = $state(true)

	onMount(async () => {
		const code = decodeURIComponent(location.hash.slice(1))
		if (!code) {
			error = "This link is missing its code. Use the full link you were given."
			loading = false
			return
		}
		try {
			const res = await fetch("/api/apply", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ code })
			})
			const body = await res.json()
			if (res.ok) status = body
			else error = body.message || "Couldn't find that application"
		} catch {
			error = "Couldn't check right now, try again in a moment"
		}
		loading = false
	})

	let expired = $derived(
		!!status?.invite?.expiry && new Date(status.invite.expiry) < new Date()
	)
	let registerLink = $derived(
		status?.invite
			? `/register?invite=${encodeURIComponent(status.invite.code)}&username=${encodeURIComponent(status.username)}`
			: ""
	)
</script>

<Head name={data.siteName} title="Your application" />

<LoginShell
	name={data.siteName}
	tagline={data.tagline}
	descriptions={[["Your application", "Check back here: if you're accepted, this page gives you your invite."]]}>
	{#if loading}
		<h2>Checking...</h2>
	{:else if error}
		<h2>Application not found</h2>
		<p class="pt-2">{error}</p>
	{:else if status}
		<div class="eyebrow pb-2">Application for {status.username}</div>
		{#if status.status === "pending"}
			<h2>Waiting for review</h2>
			<p class="pt-2">
				Staff haven't looked at it yet. Sent
				{new Date(status.created).toLocaleDateString()}; check back later.
			</p>
		{:else if status.status === "rejected"}
			<h2>Not accepted</h2>
			<p class="pt-2">Sorry, your application wasn't accepted.</p>
			{#if status.note}
				<blockquote class="note">{status.note}</blockquote>
			{/if}
		{:else}
			<h2>You're in!</h2>
			{#if status.note}
				<blockquote class="note">{status.note}</blockquote>
			{/if}
			{#if status.invite?.used}
				<p class="pt-2">
					Your invite has been used. <a href="/login">Log in</a>
				</p>
			{:else if expired}
				<p class="pt-2">
					Your invite expired. Apply again, or ask staff for a new one.
				</p>
			{:else if status.invite}
				<p class="pt-2 pb-4">
					Your invite is ready{status.invite.expiry
						? `, until ${new Date(status.invite.expiry).toLocaleDateString()}`
						: ""}:
				</p>
				<div class="code mono">{status.invite.code}</div>
				<a href={registerLink} class="btn btn-primary w-full mt-4">
					Create your account
				</a>
			{/if}
		{/if}
	{/if}
</LoginShell>

<style>
	.note {
		margin: 1rem 0 0;
		padding: 0.5rem 0.875rem;
		color: var(--grey-text);
		border-left: 2px solid var(--accent3);
	}

	.code {
		padding: 0.625rem 0.75rem;
		word-break: break-all;
		background: var(--darker);
		border: 1px solid var(--accent2);
		user-select: all;
	}
</style>
