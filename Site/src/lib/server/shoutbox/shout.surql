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
	history
FROM ONLY $shout;
