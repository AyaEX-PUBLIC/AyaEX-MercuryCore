# the latest published news posts
SELECT
	record::id(id) AS id,
	title,
	published
FROM news
WHERE published != NONE AND published <= time::now()
ORDER BY published DESC
LIMIT 3;
