<script lang="ts">
	const { data }: { data: import("./$types").PageData } = $props()

	let { user } = $derived(data)
</script>

<div class="pb-6">
	<label for="name" class="block pb-2">Username</label>
	<input type="text" readonly id="name" disabled value={user?.username} />
	<small class="formhelp">You cannot change your username.</small>
</div>

{#if user.email}
	<div class="pb-2">
		<label for="email" class="block pb-2">Email address</label>
		<input type="text" readonly id="email" value={user.email} />
	</div>
{/if}

<!-- <hr class="grey-text" /> -->
<!-- <h3 class="text-base">Email Verification</h3>
<p>You have not verified your email address.</p>
<button class="btn btn-tertiary">
	<fa fa-envelope-circle-check class="pr-2"></fa>
	Verify Email
</button> -->
