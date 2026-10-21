# every post, drafts and scheduled ones too, newest first
SELECT
	record::id(id) AS id,
	title,
	cover,
	created,
	published,
	updated,
	(SELECT status, username FROM ONLY $parent.author) AS author
FROM news
ORDER BY created DESC
LIMIT 200;
