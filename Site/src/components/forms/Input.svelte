<script lang="ts">
	import type {
		HTMLInputAttributes,
		HTMLInputTypeAttribute
	} from "svelte/elements"
	import SubInput from "$components/forms/SubInput.svelte"

	const {
		name,
		label = "",
		help = "",
		after = "",
		type = "text",
		inline = false,
		column = false,
		disabled = false,
		formData,
		...rest
	}: {
		name: string
		label?: string
		help?: string
		after?: string
		type?: HTMLInputTypeAttribute
		inline?: boolean
		/** Labels are always above their inputs now; kept for compatibility */
		column?: boolean
		disabled?: boolean
		formData: import("$lib/validate").SuperForm<any>
	} & HTMLInputAttributes = $props()

	let { errors } = $derived(formData)
</script>

{#if type === "checkbox"}
	<div class="pb-6">
		<label class="check">
			<SubInput {...rest} {name} {type} {disabled} {formData} />
			{label}
		</label>
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
{:else}
	<div class={inline ? "flex-1" : "pb-6"}>
		{#if label}
			<label for={name} class="block pb-2">
				{label}
			</label>
		{/if}
		<!-- welp, boilerplate begets boilerplate -->
		{#if after}
			<div class="flex items-center gap-2">
				<SubInput {...rest} {name} {type} {disabled} {formData} />
				{@html after}
			</div>
		{:else}
			<SubInput {...rest} {name} {type} {disabled} {formData} />
		{/if}

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
{/if}

<style>
	.check {
		display: inline-flex;
		align-items: center;
		gap: 0.75rem;
		cursor: pointer;
	}
</style>
