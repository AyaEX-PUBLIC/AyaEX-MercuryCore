# history += body runs before body is replaced, so it keeps the old version
UPDATE ONLY $shout SET history += body, body = $body, edited = time::now();
SELECT
	record::id(id) AS id,
	record::id(channel) AS channel,
	{ username: author.username, level: author.permissionLevel } AS author,
	body,
	created,
	edited
FROM ONLY $shout;
