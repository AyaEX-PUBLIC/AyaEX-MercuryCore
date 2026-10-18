<script lang="ts">
	import { page } from "$app/state"

	const { formData }: { formData: import("$lib/validate").SuperForm<any> } =
		$props()

	const { form, errors, message, constraints, enhance, delayed } = formData
</script>

<form use:enhance method="post" action="?/comment" class="py-2">
	<label for="content" class="block pb-2">Post a comment</label>
	<fieldset class="max-w-160 flex flex-col gap-3">
		<textarea
			bind:value={$form.content}
			{...$constraints.content}
			class={{ "is-invalid": $errors.content }}
			id="content"
			name="content"
			placeholder="What are your thoughts?"
			rows="3">
		</textarea>
		<div class="flex items-center gap-4">
			<button class="btn btn-primary">
				<fa fa-message></fa>
				{$delayed ? "Working..." : "Comment"}
			</button>
			{#if $message || $errors.content}
				<span
					class={[
						"text-sm",
						{
							"text-emerald-400": page.status === 200,
							"text-red-400": page.status >= 400 || $errors.content
						}
					]}>
					{$message || $errors.content}
				</span>
			{/if}
		</div>
	</fieldset>
</form>
