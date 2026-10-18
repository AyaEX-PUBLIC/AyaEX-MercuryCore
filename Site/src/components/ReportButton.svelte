<script lang="ts">
	const {
		user,
		url
	}: {
		user: string
		url: string
	} = $props()
</script>

<li>
	<a class="btn text-red-400" href="/report?user={user}&url={url}">
		<fa fa-flag></fa>
		Report abuse
	</a>
</li>
