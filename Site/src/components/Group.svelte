<script lang="ts">
	// Component for a group, used on the groups and search pages.

	import Identicon from "$components/Identicon.svelte"
	import fade from "$lib/fade"

	const {
		group,
		num,
		total
	}: {
		group: {
			id: string
			name: string
			memberCount: number
		}
		num: number
		total: number
	} = $props()
</script>

<a
	in:fade={{ num, total }}
	class="group light-text"
	href="/groups/{group.id}">
	<div class="mark">
		<Identicon name={group.name} />
	</div>
	<div class="info">
		<span class="name">{group.name}</span>
		<span class="members">
			<fa fa-user></fa>
			{group.memberCount} member{group.memberCount === 1 ? "" : "s"}
		</span>
	</div>
</a>

<style>
	.group {
		display: flex;
		flex-direction: column;
		height: 100%;
		background: var(--background);
		transition: background-color 0.15s;
		&:hover {
			background: var(--accent);
		}
	}

	.mark {
		aspect-ratio: 16 / 9;
		display: grid;
		place-items: center;
		padding: 1.25rem;
		background: var(--darker);
		border-bottom: 1px solid var(--accent2);
		& :global(svg) {
			height: 100%;
			width: auto;
		}
	}

	.info {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		padding: 0.625rem 0.75rem 0.75rem;
	}

	.name {
		font-size: 0.875rem;
		font-weight: 500;
		overflow-wrap: anywhere;
	}

	.members {
		font-family: var(--font-mono);
		font-size: 0.75rem;
		color: var(--grey-text);
		& fa {
			font-size: 0.6875rem;
			padding-right: 0.25rem;
		}
	}
</style>
