# newest first, before a time if given
SELECT
	record::id(id) AS id,
	record::id(channel) AS channel,
	{ username: author.username, level: author.permissionLevel } AS author,
	body,
	created,
	edited
FROM shout
WHERE channel = $channel AND !deleted AND (!$before OR created < $before)
ORDER BY created DESC
LIMIT $limit;
