SELECT
	record::id(id) AS id,
	name,
	description,
	position,
	readLevel,
	writeLevel,
	slowmode,
	count(SELECT 1 FROM shout WHERE channel = $parent.id AND !deleted) AS messages
FROM shoutChannel WHERE !deleted
ORDER BY position, name;
