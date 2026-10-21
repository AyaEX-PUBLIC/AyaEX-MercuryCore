# a post to edit
SELECT
	record::id(id) AS id,
	title,
	body,
	cover,
	published
FROM ONLY type::record("news", $id);
