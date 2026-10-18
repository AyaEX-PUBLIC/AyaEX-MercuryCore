LET $shout = CREATE ONLY type::record("shout", rand::ulid()) CONTENT {
	author: $user,
	body: $body,
	channel: $channel,
};
SELECT
	record::id(id) AS id,
	record::id(channel) AS channel,
	{ username: author.username, level: author.permissionLevel } AS author,
	body,
	created,
	edited
FROM ONLY $shout.id;
