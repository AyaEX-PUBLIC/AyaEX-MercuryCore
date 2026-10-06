SELECT
	record::id(id) AS id,
	name,
	joinMode ?? "open" AS joinMode,
	engineId,
	(SELECT status, username FROM $parent<-ownsGroup<-user)[0] AS owner,
	$user IN <-ownsGroup<-user AS owned,
	count(<-member) AS memberCount,
	$user IN <-member<-user AS in,
	$user IN ->groupInvite->user AS invited
FROM $group;
