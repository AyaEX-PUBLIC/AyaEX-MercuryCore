<script lang="ts">
	// A symmetric 5x5 pixel pattern made from a string, for things without a picture (e.g. groups)

	const { name, size = "100%" }: { name: string; size?: string } = $props()

	// FNV-1a, so the same name always gets the same pattern
	function hash(s: string) {
		let h = 2166136261
		for (let i = 0; i < s.length; i++) {
			h ^= s.charCodeAt(i)
			h = Math.imul(h, 16777619)
		}
		return h >>> 0
	}

	let cells = $derived.by(() => {
		const h = hash(name)
		const on: [number, number][] = []
		// 3 columns, mirrored to 5
		for (let x = 0; x < 3; x++)
			for (let y = 0; y < 5; y++)
				if ((h >> (x * 5 + y)) & 1) {
					on.push([x, y])
					if (x < 2) on.push([4 - x, y])
				}
		return on
	})
	let colour = $derived(`var(--pixel-${2 + (hash(name) % 2)})`)
</script>

<svg
	viewBox="-1 -1 7 7"
	width={size}
	height={size}
	shape-rendering="crispEdges"
	aria-hidden="true">
	{#each cells as [x, y]}
		<rect {x} {y} width="1" height="1" fill={colour} />
	{/each}
</svg>
