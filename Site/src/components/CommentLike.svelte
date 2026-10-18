<script lang="ts">
	import type { ClassValue } from "svelte/elements"
	import { type LikeForm, likeFns, type Scored } from "$lib/like2"

	let {
		comment = $bindable(),
		likeForm,
		small = false,
		class: class_ = ""
	}: {
		comment: Scored & { id: string }
		likeForm: Omit<LikeForm, "for">
		small?: boolean
		class?: ClassValue
	} = $props()
</script>

<form
	{...likeForm.enhance(instance => {
		const { action } = instance.fields.value()
		likeFns[action](comment)
		comment = comment
		instance.submit()
	})}
	class={class_}>
	<input type="hidden" name="id" value={comment.id} />
	<span class={["votes", small ? "small" : "tall"]}>
		<button
			name="action"
			value={comment.likes ? "unlike" : "like"}
			aria-label={comment.likes ? "Unlike" : "Like"}
			class={{ up: comment.likes }}>
			<fa fa-thumbs-up></fa>
		</button>
		<span
			class={[
				"score",
				{
					"text-emerald-400": comment.likes,
					"text-red-400": comment.dislikes
				}
			]}>
			{comment.score}
		</span>
		<button
			name="action"
			value={comment.dislikes ? "undislike" : "dislike"}
			aria-label={comment.dislikes ? "Undislike" : "Dislike"}
			class={{ down: comment.dislikes }}>
			<fa fa-thumbs-down></fa>
		</button>
	</span>
</form>

<style>
	.votes {
		display: flex;
		align-items: center;
		&.tall {
			flex-direction: column;
			gap: 0.25rem;
			padding: 0.5rem 0.25rem;
		}
	}

	button {
		display: grid;
		place-items: center;
		width: 1.75rem;
		height: 1.75rem;
		padding: 0;
		font-size: 0.8125rem;
		color: var(--dim-text);
		background: none;
		border: 0;
		cursor: pointer;
		transition:
			color 0.15s,
			background-color 0.15s;
		&:hover {
			color: var(--light-text);
			background: var(--accent1);
		}
		&.up {
			color: var(--success);
		}
		&.down {
			color: var(--danger);
		}
	}

	.score {
		min-width: 1.5rem;
		font-family: var(--font-mono);
		font-size: 0.8125rem;
		font-weight: 500;
		text-align: center;
	}
</style>
