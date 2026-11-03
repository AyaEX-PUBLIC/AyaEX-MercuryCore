LET $shout = CREATE ONLY type::record("shout", rand::ulid()) CONTENT {
	author: $user,
	body: $body,
	channel: $channel,
	replyTo: $replyTo,
};
SELECT
	record::id(id) AS id,
	record::id(channel) AS channel,
	{ username: author.username, level: author.permissionLevel } AS author,
	body,
	created,
	edited,
	replyTo.{ id: record::id(id), deleted, author: author.username, body } AS replyTo,
	<-reacted.{ emoji, username: in.username, created } AS reactions
FROM ONLY $shout.id;
