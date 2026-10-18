<script lang="ts">
	const {
		beginJoining,
		scheme,
		serverTicket,
		domain,
		siteName
	}: {
		beginJoining: (joinscripturl: () => string) => () => void
		scheme: string
		serverTicket: string
		domain: string
		siteName: string
	} = $props()

	let filepath = $state("")

	let host = $derived(
		beginJoining(
			() =>
				// TODO: fix hosting and map opening with correct URI scheme
				`${scheme}20131+launchmode:ide+script:http://${domain}/game/host?ticket=${serverTicket}&autopilot=${btoa(
					filepath
				)}`
		)
	)
</script>

<p>
	Autopilot manages initial Studio operations. All you need to do is type in a
	map that's in the map folder, and start the server.
</p>
<p>
	Place your maps in {siteName} Studio's maps folder. For example, entering
	<code>CoolMap.rbxl</code>
	will point to
	<code>content/maps/CoolMap.rbxl</code>
</p>
<div class="input-group">
	<input
		type="text"
		id="filepath"
		bind:value={filepath}
		placeholder="Map location"
		aria-label="Map location" />
	<button
		class="btn btn-secondary"
		onclick={beginJoining(() => `${scheme}20131+launchmode:maps`)}
		type="button">
		<fa fa-arrow-up-right-from-square></fa>
		Map Folder
	</button>
	<button class="btn btn-primary" onclick={host} type="button">
		<fa fa-wifi></fa>
		Begin Hosting
	</button>

	<div class="dropdown">
		<div class="btn btn-tertiary dropdown-toggle" aria-label="More hosting options">
		</div>
		<div class="dropdown-content">
			<ul>
				<li>
					<button
						class="btn light-text"
						onclick={host}
						type="button">
						Begin Hosting (no Studio tools)
					</button>
				</li>
			</ul>
		</div>
	</div>
</div>

<style>
	.dropdown-toggle::after {
		/* funny down arrow */
		display: inline-block;
		vertical-align: 0.255rem;
		content: "";
		border-top: 0.3rem solid;
		border-right: 0.3rem solid transparent;
		border-left: 0.3rem solid transparent;
	}
</style>
