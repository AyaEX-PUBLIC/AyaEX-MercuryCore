<script lang="ts">
	import type { HTMLTextareaAttributes } from "svelte/elements"

	const {
		name,
		label = "",
		help = "",
		placeholder = "",
		rows = 3,
		lowpad = false,
		defaultValue = "",
		formData,
		...rest
	}: {
		name: string
		label?: string
		help?: string
		placeholder?: string
		rows?: number
		lowpad?: boolean
		defaultValue?: string
		formData: import("$lib/validate").SuperForm<any>
	} & HTMLTextareaAttributes = $props()

	let { form, errors, constraints } = $derived(formData)

	// TODO: prevent tabs in textarea caused by... the formatter....
	$effect(() => {
		$form[name] = defaultValue
	})
</script>

<div class={lowpad ? "pb-4" : "pb-6"}>
	{#if label}
		<label for={name} class="block pb-2">
			{label}
		</label>
	{/if}
	<div>
		<textarea
			{...rest}
			bind:value={$form[name]}
			{...$constraints[name]}
			{name}
			id={name}
			{rows}
			placeholder={placeholder || null}
			class={{ "is-invalid": $errors[name] }}>
		</textarea>

		{#if help}
			<small class="formhelp">
				{@html help}
			</small>
		{/if}

		{#if $errors[name]}
			<small class="block text-red-400 pt-1">
				{$errors[name]}
			</small>
		{/if}
	</div>
</div>
