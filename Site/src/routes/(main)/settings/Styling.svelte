<script lang="ts">
	import Codearea from "$components/forms/Codearea.svelte"
	import Form from "$components/forms/Form.svelte"
	import sanitiseCss from "$lib/userCss"
	import { superForm } from "$lib/validate"

	const { data }: { data: import("./$types").PageData } = $props()

	// (the server fills the form with the saved CSS)
	let formData = $derived(superForm(data.stylingForm))
	let { form } = $derived(formData)

	// The preview applies the CSS the way saving would, sanitised, as a
	// constructed stylesheet (the page's CSP allows no new <style> elements)
	let preview: CSSStyleSheet | null = null
	let previewNote = $state("")
	function showPreview() {
		const { css, removed } = sanitiseCss($form.css || "")
		if (!preview) {
			preview = new CSSStyleSheet()
			document.adoptedStyleSheets = [...document.adoptedStyleSheets, preview]
		}
		preview.replaceSync(css)
		previewNote = removed.length
			? `Left out: ${removed.slice(0, 3).join("; ")}${removed.length > 3 ? ` and ${removed.length - 3} more` : ""}.`
			: ""
	}
</script>

<Form {formData} action="?/styling" submit="<fa fa-save></fa> Save changes">
	<Codearea
		{formData}
		rows={15}
		name="css"
		label="Custom CSS"
		placeholder="/* Enter your CSS here! Maximum 10 000 characters. */"
		help="This styling will be applied to every page, only for you. Maximum 10 000 characters. Rules, @media, @supports and @keyframes; no url(), @import or @font-face." />

	<span class="pr-2">
		<button
			type="button"
			class="btn btn-tertiary"
			onclick={e => {
				e.preventDefault()
				showPreview()
			}}>
			Preview
		</button>
	</span>
	{#if previewNote}
		<p class="grey-text text-sm pt-2">{previewNote}</p>
	{/if}
</Form>
