<script lang="ts">
	const {
		name,
		label = "",
		help = "",
		placeholder = "",
		rows,
		formData,
		...rest
	}: {
		name: string
		label?: string
		help?: string
		placeholder?: string
		rows?: number
		formData: import("$lib/validate").SuperForm<any>
	} = $props()

	const { form, errors, constraints } = formData
</script>

<div class="pb-6">
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
			class={["code", { "is-invalid": $errors[name] }]}>
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

<style>
	.code {
		font-family: var(--font-mono);
		font-size: 0.8125rem;
		tab-size: 4;
	}
</style>
