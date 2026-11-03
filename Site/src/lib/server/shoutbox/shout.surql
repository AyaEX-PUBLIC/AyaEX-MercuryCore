SELECT
	record::id(id) AS id,
	record::id(channel) AS channel,
	record::id(author) AS authorId,
	{ username: author.username, level: author.permissionLevel } AS author,
	body,
	created,
	edited,
	deleted,
	deletedBy.username AS deletedBy,
	history,
	replyTo.{ id: record::id(id), deleted, author: author.username, body } AS replyTo,
	<-reacted.{ emoji, username: in.username, created } AS reactions
FROM ONLY $shout;
