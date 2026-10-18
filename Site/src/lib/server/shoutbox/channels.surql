SELECT
	record::id(id) AS id,
	name,
	description,
	position,
	readLevel,
	writeLevel,
	slowmode,
	(SELECT created, author.username AS by FROM shout
		WHERE channel = $parent.id AND !deleted
		ORDER BY created DESC LIMIT 1)[0] AS latest
FROM shoutChannel WHERE !deleted
ORDER BY position, name;
