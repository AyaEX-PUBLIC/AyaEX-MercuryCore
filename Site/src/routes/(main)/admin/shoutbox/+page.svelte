<script lang="ts">
	import { enhance } from "$app/forms"
	import { page } from "$app/state"
	import Breadcrumbs from "$components/Breadcrumbs.svelte"
	import Head from "$components/Head.svelte"

	const { data, form } = $props()

	const levels = [
		[1, "Everyone"],
		[2, "Verified and above"],
		[3, "Catalog managers and above"],
		[4, "Moderators and above"],
		[5, "Administrators"]
	] as const

	const blank = {
		id: "",
		name: "",
		description: "",
		position: 0,
		readLevel: 1,
		writeLevel: 1,
		slowmode: 0
	}
</script>

<Head name={data.siteName} title="Shoutbox - Admin" />

{#snippet fields(c: typeof blank)}
	<div class="fields">
		<label>
			<span class="eyebrow">Name</span>
			<span class="input-prefix">
				<span>#</span>
				<input
					name="name"
					value={c.name}
					required
					maxlength="24"
					pattern="[a-z0-9]([a-z0-9\-]*[a-z0-9])?"
					placeholder="general"
					title="Lowercase letters, numbers and dashes" />
			</span>
		</label>
		<label>
			<span class="eyebrow">Position</span>
			<input name="position" type="number" min="0" max="999" value={c.position} />
		</label>
		<label class="wide">
			<span class="eyebrow">Description</span>
			<input
				name="description"
				value={c.description}
				maxlength="120"
				placeholder="What the channel is for" />
		</label>
		<label>
			<span class="eyebrow">Who can read</span>
			<select name="readLevel">
				{#each levels as [level, name]}
					<option value={level} selected={c.readLevel === level}>{name}</option>
				{/each}
			</select>
		</label>
		<label>
			<span class="eyebrow">Who can post</span>
			<select name="writeLevel">
				{#each levels as [level, name]}
					<option value={level} selected={c.writeLevel === level}>{name}</option>
				{/each}
			</select>
		</label>
		<label>
			<span class="eyebrow">Slow mode (seconds)</span>
			<input name="slowmode" type="number" min="0" max="3600" value={c.slowmode} />
		</label>
	</div>
{/snippet}

<div class="ctnr">
	<div class="page-head">
		<div>
			<Breadcrumbs path={[["Admin", "/admin"]]} final="Shoutbox" />
			<h1>Shoutbox channels</h1>
			<p>
				Channels are shown on everyone's home page, in this order.
				Readers below a channel's level don't see it at all; moderators
				can delete messages and aren't slowed down.
			</p>
		</div>
	</div>

	{#if form?.msg && !form.id}
		<p class={["alert-line", { bad: page.status >= 400 }]}>
			{form.msg}
		</p>
	{/if}

	<div class="grid gap-6 lg:grid-cols-[20rem_minmax(0,1fr)] items-start">
		<section class="panel">
			<div class="panel-head"><span>New channel</span></div>
			<form method="post" action="?/create" use:enhance class="p-4">
				{@render fields(blank)}
				<button class="btn btn-primary mt-4">
					<fa fa-plus></fa>
					Create channel
				</button>
			</form>
		</section>

		<div class="flex flex-col gap-4">
			{#each data.channels as c (c.id)}
				<section class="panel">
					<div class="panel-head">
						<span class="normal-case tracking-normal light-text text-sm font-600">
							#{c.name}
						</span>
						<span>{c.messages} messages</span>
					</div>
					<form method="post" action="?/update&id={c.id}" use:enhance={() => async ({ update }) => update({ reset: false })} class="p-4">
						{@render fields(c)}
						<div class="flex flex-wrap items-center gap-3 mt-4">
							<button class="btn btn-secondary btn-sm">
								<fa fa-floppy-disk></fa>
								Save
							</button>
							<a href="/home?channel={c.id}" class="btn btn-tertiary btn-sm">
								<fa fa-messages></fa>
								Open
							</a>
							{#if form?.id === c.id && form.msg}
								<span class={["text-sm", page.status >= 400 ? "text-red-400" : "grey-text"]}>
									{form.msg}
								</span>
							{/if}
						</div>
					</form>
					<details class="line-t">
						<summary>Delete channel</summary>
						<form method="post" action="?/delete&id={c.id}" use:enhance class="pb-4 px-4">
							<p class="grey-text text-sm">
								#{c.name} disappears for everyone. Its messages are
								kept in the database for moderation.
							</p>
							<button class="btn btn-danger btn-sm">
								<fa fa-trash></fa>
								Delete #{c.name}
							</button>
						</form>
					</details>
				</section>
			{:else}
				<div class="empty">
					<b>No channels</b>
					<p>Create one, and it shows up on the home page.</p>
				</div>
			{/each}
		</div>
	</div>
</div>

<style>
	.fields {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(13rem, 1fr));
		gap: 0.875rem 1rem;
		& label {
			display: flex;
			flex-direction: column;
			gap: 0.375rem;
		}
		& .wide {
			grid-column: 1 / -1;
		}
	}

	.input-prefix {
		display: flex;
		align-items: center;
		& span {
			padding: 0 0.625rem;
			align-self: stretch;
			display: flex;
			align-items: center;
			color: var(--grey-text);
			background: var(--accent);
			border: 1px solid var(--accent2);
			border-right: 0;
		}
	}

	details summary {
		padding: 0.625rem 1rem;
		font-size: 0.8125rem;
		color: var(--grey-text);
		cursor: pointer;
		&:hover {
			color: var(--danger);
		}
	}

	.alert-line {
		margin-bottom: 1.5rem;
		padding: 0.625rem 1rem;
		font-size: 0.875rem;
		border: 1px solid var(--success-line);
		color: var(--success);
		&.bad {
			border-color: var(--danger-line);
			color: var(--danger);
		}
	}
</style>
