# a post, and the latest others to read next
SELECT
	record::id(id) AS id,
	title,
	body,
	excerpt,
	cover,
	created,
	published,
	updated,
	(SELECT status, username FROM ONLY $parent.author) AS author
FROM ONLY type::record("news", $id);

SELECT
	record::id(id) AS id,
	title,
	excerpt,
	cover,
	published
FROM news
WHERE published != NONE AND published <= time::now() AND record::id(id) != $id
ORDER BY published DESC
LIMIT 3;
