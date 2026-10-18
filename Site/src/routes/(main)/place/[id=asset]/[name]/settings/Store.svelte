<script lang="ts">
	import { enhance } from "$app/forms"
	import { page } from "$app/state"
	import { encode } from "$lib/urlName"

	const { data }: { data: import("./$types").PageData } = $props()

	const message = $derived((page.form as { store?: string } | null)?.store)
	const icon = (id: number, name: string) => `/catalog/${id}/${encode(name) || "item"}/icon`

	type Kind = "pass" | "product" | "badge"
	const sections: { kind: Kind; title: string; one: string; help: string; action: string }[] = [
		{
			kind: "pass",
			title: "Game passes",
			one: "game pass",
			help: "Bought once, kept forever. In scripts: MarketplaceService:PromptGamePassPurchase(player, id) and GamePassService:PlayerHasPass(player, id). Players can also buy them on the place page.",
			action: "createpass",
		},
		{
			kind: "product",
			title: "Developer products",
			one: "developer product",
			help: "Bought any number of times in game, e.g. currency or boosts. In scripts: MarketplaceService:PromptProductPurchase(player, id), and grant the purchase in MarketplaceService.ProcessReceipt.",
			action: "createproduct",
		},
		{
			kind: "badge",
			title: "Badges",
			one: "badge",
			help: "Awarded by your game's server: BadgeService:AwardBadge(player.userId, id). Check with BadgeService:UserHasBadge(player.userId, id). Badges show on the place page and players' profiles.",
			action: "createbadge",
		},
	]

	const items = (kind: Kind) =>
		kind === "pass" ? data.gamePasses : kind === "badge" ? data.badges : data.devProducts
</script>

{#if message}
	<p class="alert mb-4">{message}</p>
{/if}

{#each sections as section}
	<h3 class="text-base pt-6 mt-2 line-t first:border-0 first:mt-0 first:pt-2">{section.title}</h3>
	<p class="grey-text pt-1 pb-4 text-sm">{section.help}</p>

	{#if items(section.kind).length}
		<table class="w-full mb-4 text-sm">
			<thead>
				<tr class="text-left">
					{#if section.kind !== "product"}<th></th>{/if}
					<th>Name</th>
					<th>ID</th>
					{#if section.kind !== "badge"}<th>Price</th>{/if}
					<th>{section.kind === "badge" ? "Awarded" : "Sold"}</th>
					<th></th>
				</tr>
			</thead>
			<tbody>
				{#each items(section.kind) as item (item.id)}
					{@const sold = "count" in item ? item.count : item.sales}
					<tr>
						{#if section.kind !== "product"}
							<td class="py-1 pr-2">
								<img src={icon(item.id, item.name)} alt="" class="size-10 bg-darker" />
							</td>
						{/if}
						<td class="pr-2">{item.name}</td>
						<td class="pr-2"><code>{item.id}</code></td>
						{#if section.kind !== "badge"}
							<td class="pr-2">
								<form method="post" action="?/updateitem&tab=Store" use:enhance class="flex gap-1 items-center">
									<input type="hidden" name="item" value={item.id} />
									<input type="hidden" name="kind" value={section.kind === "product" ? "devProduct" : "asset"} />
									<span>{data.currencySymbol}</span>
									<input
										name="price"
										type="number"
										min={section.kind === "product" ? 1 : 0}
										value={item.price}
										class="w-24" />
									<button class="btn btn-sm btn-secondary" aria-label="Save price">
										<fa fa-save></fa>
									</button>
								</form>
							</td>
						{/if}
						<td class="pr-2">{sold}</td>
						<td>
							<form method="post" action="?/updateitem&tab=Store" use:enhance>
								<input type="hidden" name="item" value={item.id} />
								<input type="hidden" name="kind" value={section.kind === "product" ? "devProduct" : "asset"} />
								<input type="hidden" name="forSale" value={String(!item.forSale)} />
								<button class="btn btn-sm {item.forSale ? 'btn-red-secondary' : 'btn-secondary'}">
									{#if section.kind === "badge"}
										{item.forSale ? "Disable" : "Enable"}
									{:else}
										{item.forSale ? "Take off sale" : "Put on sale"}
									{/if}
								</button>
							</form>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}

	<form
		method="post"
		action="?/{section.action}&tab=Store"
		enctype="multipart/form-data"
		use:enhance
		class="panel bg-darker p-4 mb-6 flex flex-col gap-3">
		<b>New {section.one}</b>
		<input name="name" placeholder="Name" minlength="3" maxlength="50" required />
		<textarea name="description" placeholder="Description (optional)" maxlength="1000" rows="2"></textarea>
		{#if section.kind !== "badge"}
			<label class="flex gap-2 items-center">
				Price ({data.currencySymbol})
				<input
					name="price"
					type="number"
					min={section.kind === "product" ? 1 : 0}
					value={section.kind === "product" ? 1 : 0}
					required
					class="w-32" />
			</label>
		{/if}
		{#if section.kind !== "product"}
			<label class="flex gap-2 items-center">
				Icon
				<input name="icon" type="file" accept="image/*" />
			</label>
		{/if}
		<button class="btn btn-primary self-start">
			<fa fa-plus></fa>
			Create
		</button>
	</form>
{/each}
