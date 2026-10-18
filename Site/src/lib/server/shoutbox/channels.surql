SELECT
	record::id(id) AS id,
	name,
	description,
	position,
	readLevel,
	writeLevel,
	slowmode,
	(SELECT VALUE created FROM shout
		WHERE channel = $parent.id AND !deleted
		ORDER BY created DESC LIMIT 1)[0] AS last
FROM shoutChannel WHERE !deleted
ORDER BY position, name;
