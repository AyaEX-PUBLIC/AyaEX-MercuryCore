<script lang="ts">
	import { enhance as plainEnhance } from "$app/forms"
	import { page } from "$app/state"
	import Breadcrumbs from "$components/Breadcrumbs.svelte"
	import Head from "$components/Head.svelte"
	import Markdown from "$components/Markdown.svelte"
	import SidebarShell from "$components/SidebarShell.svelte"
	import Tab from "$components/Tab.svelte"
	import TabData from "$components/TabData"
	import User from "$components/User.svelte"
	import { parse } from "$lib/markdown"
	import { encode } from "$lib/urlName"
	import { superForm } from "$lib/validate"

	const { data } = $props()

	let tabData = $state(
		TabData(
			page.url.href,
			["Write post", "All posts"],
			["fa-pencil", "fa-list"]
		)
	)
	// saving redirects here with ?tab=, and Edit links have none: follow the
	// address, which the tab component doesn't do on its own
	$effect.pre(() => {
		tabData.currentTab = page.url.searchParams.get("tab") || tabData.tabs[0]
	})

	let formData = $derived(superForm(data.form))
	let { form, errors, enhance, delayed, message } = $derived(formData)

	// the date input works in the browser's time zone; the server gets UTC
	const toLocal = (d?: Date | null) =>
		d
			? new Date(d.getTime() - d.getTimezoneOffset() * 60000)
					.toISOString()
					.slice(0, 16)
			: ""
	let publishLocal = $state("")
	$effect.pre(() => {
		publishLocal = toLocal(data.editing?.published)
	})
	let publishAt = $derived(
		publishLocal && !Number.isNaN(new Date(publishLocal).getTime())
			? new Date(publishLocal).toISOString()
			: ""
	)

	let removeCover = $state(false)
	$effect.pre(() => {
		data.editing
		removeCover = false
	})

	let blocks = $derived(parse($form.body ?? ""))

	let scheduled = $derived(
		!!publishAt && new Date(publishAt).getTime() > Date.now()
	)
	let publishLabel = $derived(
		scheduled ? "Schedule" : data.editing?.published ? "Save changes" : "Publish"
	)

	const status = (p: (typeof data.posts)[number]) =>
		!p.published
			? (["Draft", ""] as const)
			: p.published.getTime() > Date.now()
				? (["Scheduled", "badge-warning"] as const)
				: (["Published", "badge-success"] as const)

	let confirming = $state("")

	const syntax = [
		["# Heading", "Headings: ## and ### for smaller ones"],
		["**bold**  *italic*  ~~strike~~", "Emphasis"],
		["`code`", "Inline code"],
		["[text](https://example.com)", "A link; a site page works too: [Rules](/rules)"],
		["![description](https://example.com/picture.png)", "A picture, from an https address"],
		["- item", "A list; 1. item for a numbered one, - [ ] item for tasks"],
		["> quote", "A quotation"],
		["---", "A dividing line"],
		["```", "A block of code, closed with ``` again"],
		["| A | B |", "A table: a second line of |---|---| follows the header"]
	]
</script>

<Head name={data.siteName} title="News - Admin" />

<div class="ctnr">
	<div class="page-head">
		<div>
			<Breadcrumbs path={[["Admin", "/admin"]]} final="News" />
			<h1>News</h1>
			<p>Announcements for the News page, written in Markdown.</p>
		</div>
		<a href="/news" class="btn btn-sm btn-tertiary">
			<fa fa-arrow-right></fa>
			View News
		</a>
	</div>
</div>

<SidebarShell bind:tabData>
	<Tab bind:tabData>
		{#if data.editing}
			<p class="editing">
				<span class="eyebrow">Editing</span>
				<a href="/news/{data.editing.id}/{encode(data.editing.title)}">{data.editing.title}</a>
			</p>
		{/if}

		<form
			use:enhance
			method="post"
			action="?/save"
			enctype="multipart/form-data"
			class="editor">
			{#if data.editing}
				<input type="hidden" name="id" value={data.editing.id} />
			{/if}
			<input type="hidden" name="publishAt" value={publishAt} />

			<div class="meta">
				<div>
					<label for="title">Title</label>
					<input
						id="title"
						name="title"
						bind:value={$form.title}
						maxlength="100"
						placeholder="3 to 100 characters"
						class={{ "is-invalid": $errors.title }} />
					{#if $errors.title}
						<small class="block text-red-400 pt-1">{$errors.title}</small>
					{/if}
				</div>

				<div>
					<label for="publishLocal">Publish at</label>
					<input id="publishLocal" type="datetime-local" bind:value={publishLocal} />
					<small class="formhelp">
						Leave empty to publish right away. A date to come schedules the post; it's hidden until then.
					</small>
					{#if $errors.publishAt}
						<small class="block text-red-400 pt-1">{$errors.publishAt}</small>
					{/if}
				</div>

				<div>
					<label for="cover">Cover image</label>
					{#if data.editing?.cover && !removeCover}
						<img
							class="current"
							src="/news/cover/{data.editing.id}"
							alt="The current cover" />
					{/if}
					<input id="cover" name="cover" type="file" accept="image/*" class={{ "is-invalid": $errors.cover }} />
					<small class="formhelp">Optional. Cropped to 16:9 (1280×720), up to 5MB.</small>
					{#if $errors.cover}
						<small class="block text-red-400 pt-1">{$errors.cover}</small>
					{/if}
					{#if data.editing?.cover}
						<label class="check">
							<input type="checkbox" name="removeCover" bind:checked={removeCover} />
							Remove the current cover
						</label>
					{/if}
				</div>
			</div>

			<div class="write">
				<div>
					<label for="body">Post</label>
					<textarea
						id="body"
						name="body"
						bind:value={$form.body}
						rows="24"
						spellcheck="true"
						placeholder="Write in Markdown..."
						class={["source", { "is-invalid": $errors.body }]}></textarea>
					{#if $errors.body}
						<small class="block text-red-400 pt-1">{$errors.body}</small>
					{/if}
				</div>

				<div class="preview panel" aria-label="Preview">
					<div class="panel-head">
						<span>Preview</span>
						<span class="dim-text">{($form.body ?? "").length.toLocaleString()} / 20,000</span>
					</div>
					<div class="sheet">
						{#if blocks.length > 0}
							<Markdown {blocks} />
						{:else}
							<p class="dim-text">Nothing to preview yet.</p>
						{/if}
					</div>
				</div>
			</div>

			<details class="help">
				<summary>Formatting help</summary>
				<dl>
					{#each syntax as [code, what]}
						<div>
							<dt><code>{code}</code></dt>
							<dd>{what}</dd>
						</div>
					{/each}
				</dl>
				<p class="dim-text">HTML isn't allowed. Anything between angle brackets is shown as text.</p>
			</details>

			<div class="actions">
				<button class="btn btn-primary" name="intent" value="publish">
					{$delayed ? "Working..." : publishLabel}
				</button>
				<button class="btn btn-secondary" name="intent" value="draft">
					{data.editing?.published ? "Unpublish and save as draft" : "Save as draft"}
				</button>
				{#if data.editing}
					<a href="/admin/news" class="btn btn-tertiary">Cancel</a>
				{/if}
			</div>
			{#if $message}
				<p class="text-red-400 text-sm pt-2">{$message}</p>
			{/if}
		</form>
	</Tab>

	<Tab bind:tabData>
		{#if page.url.searchParams.get("saved")}
			<div class="alert" role="status">
				{page.url.searchParams.get("saved") === "draft"
					? "Saved as a draft."
					: "Saved."}
			</div>
		{/if}

		{#if data.posts.length === 0}
			<div class="empty">
				<strong>No posts yet</strong>
				<p>Write the first one in the other tab.</p>
			</div>
		{:else}
			<table class="w-full">
				<thead>
					<tr>
						<th scope="col">Post</th>
						<th scope="col">Status</th>
						<th scope="col">Author</th>
						<th scope="col">Updated</th>
						<th scope="col"><span class="sr-only">Options</span></th>
					</tr>
				</thead>
				<tbody>
					{#each data.posts as post (post.id)}
						{@const [label, tone] = status(post)}
						<tr>
							<td>
								<a href="/news/{post.id}/{encode(post.title)}">{post.title}</a>
								{#if post.cover}<fa fa-image class="dim-text pl-1" title="Has a cover"></fa>{/if}
							</td>
							<td>
								<span class={["badge", tone]}>{label}</span>
								{#if post.published}
									<span class="dim-text text-xs block pt-1">{post.published.toLocaleString()}</span>
								{/if}
							</td>
							<td><User user={post.author} full thin size="1.5rem" /></td>
							<td>{post.updated.toLocaleDateString()}</td>
							<td class="options">
								<a href="?edit={post.id}" class="btn btn-sm btn-tertiary">
									<fa fa-pencil></fa>
									Edit
								</a>
								{#if post.published && post.published.getTime() <= Date.now()}
									<form use:plainEnhance method="post" action="?/unpublish&id={post.id}">
										<button class="btn btn-sm btn-tertiary">
											<fa fa-eye-slash></fa>
											Unpublish
										</button>
									</form>
								{:else}
									<form use:plainEnhance method="post" action="?/publish&id={post.id}">
										<button class="btn btn-sm btn-tertiary">
											<fa fa-eye></fa>
											Publish
										</button>
									</form>
								{/if}
								{#if confirming === post.id}
									<form use:plainEnhance method="post" action="?/delete&id={post.id}">
										<button class="btn btn-sm btn-danger">
											<fa fa-trash></fa>
											Really delete
										</button>
									</form>
									<button type="button" class="btn btn-sm btn-tertiary" onclick={() => (confirming = "")}>
										Keep
									</button>
								{:else}
									<button type="button" class="btn btn-sm btn-tertiary text-red-400" onclick={() => (confirming = post.id)}>
										<fa fa-trash></fa>
										Delete
									</button>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}
	</Tab>
</SidebarShell>

<style>
	.editing {
		display: flex;
		align-items: baseline;
		gap: 0.75rem;
		margin: 0 0 1.25rem;
		padding: 0.625rem 1rem;
		background: var(--accent);
		border: 1px solid var(--accent2);
	}

	.meta {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 0 1.5rem;
		margin-bottom: 1.5rem;
		@media (min-width: 1024px) {
			grid-template-columns: minmax(0, 2fr) minmax(0, 1fr) minmax(0, 1fr);
		}
		& > div {
			padding-bottom: 1rem;
		}
		& small {
			display: block;
		}
	}

	.current {
		display: block;
		width: 100%;
		max-width: 16rem;
		aspect-ratio: 16 / 9;
		object-fit: cover;
		margin-bottom: 0.5rem;
		border: 1px solid var(--accent2);
	}

	.check {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding-top: 0.5rem;
		cursor: pointer;
	}

	.write {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 1.5rem;
		@media (min-width: 1536px) {
			grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		}
	}

	.source {
		min-height: 28rem;
		font-family: var(--font-mono);
		font-size: 0.875rem;
		line-height: 1.6;
		resize: vertical;
		tab-size: 4;
	}

	.preview {
		align-self: start;
		& .sheet {
			max-height: 36rem;
			overflow: auto;
			padding: 1rem 1.25rem;
		}
	}

	.help {
		margin: 1.5rem 0 0;
		padding: 0.75rem 1rem;
		background: var(--accent);
		border: 1px solid var(--accent2);
		& summary {
			cursor: pointer;
		}
		& dl {
			display: grid;
			gap: 0.5rem 1.5rem;
			margin: 0.75rem 0;
			@media (min-width: 768px) {
				grid-template-columns: 1fr 1fr;
			}
		}
		& dl > div {
			display: flex;
			flex-direction: column;
			gap: 0.125rem;
		}
		& dt code {
			white-space: pre-wrap;
		}
		& dd {
			margin: 0;
			font-size: 0.875rem;
			color: var(--grey-text);
		}
		& p {
			padding: 0;
		}
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		margin-top: 1.5rem;
	}

	.options {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.375rem;
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}
</style>
