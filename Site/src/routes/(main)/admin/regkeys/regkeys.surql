SELECT
	record::id(id) AS id,
	created,
	usesLeft,
	expiry,
	discordId,
	discordName,
	(<-used<-user.username)[0] AS usedBy,
	(SELECT status, username FROM $parent.creator)[0] AS creator
FROM regKey ORDER BY created DESC;
