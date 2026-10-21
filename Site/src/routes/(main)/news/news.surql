# a page of the published posts, newest first, then how many there are in all
SELECT
	record::id(id) AS id,
	title,
	excerpt,
	cover,
	published,
	updated,
	(SELECT status, username FROM ONLY $parent.author) AS author
FROM news
WHERE published != NONE AND published <= time::now()
ORDER BY published DESC
LIMIT $limit START $start;

count(SELECT 1 FROM news WHERE published != NONE AND published <= time::now());
