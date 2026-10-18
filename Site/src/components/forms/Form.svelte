<script lang="ts">
	import type { Snippet } from "svelte"
	import type { HTMLFormAttributes } from "svelte/elements"
	import { page } from "$app/state"

	const {
		working = "Working...",
		submit = "Submit",
		inline = false,
		nopad = false, // Don't pad the icon on the submit button
		// method = "post",
		formData,
		children,
		...rest
	}: {
		working?: string
		submit?: string
		inline?: boolean
		nopad?: boolean // Don't pad the icon on the submit button
		// method?: HTMLFormAttributes["method"]
		formData: import("$lib/validate").SuperForm<any>
		children: Snippet
	} & HTMLFormAttributes = $props()

	let { errors, message, enhance, delayed } = $derived(formData)

	// use:enhance may not be used on forms that aren't method === "post"
	// const use = method?.toLowerCase() === "post" ? enhance : () => {}

	let other = $derived($errors.other || "")
</script>

<form use:enhance method="post" {...rest}>
	<fieldset class={inline ? "input-group" : ""}>
		{@render children()}
		{#if submit}
			<button class="btn btn-primary">
				{@html /* ecks ess ess moment */ $delayed ? working : submit}
			</button>
		{/if}
	</fieldset>
	{#if other}
		<p class="text-red-400 text-sm pt-2">
			{other}
		</p>
	{/if}
</form>

{#if $message}
	<p
		class={[
			"text-sm pt-2",
			{
				"text-emerald-400": page.status === 200,
				"text-red-400": page.status >= 400
			}
		]}>
		{$message}
	</p>
{/if}
