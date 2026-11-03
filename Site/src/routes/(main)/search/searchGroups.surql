# a page of results, alphabetically, then how many there are
SELECT
	record::id(id) AS id,
	name,
	count(<-member) AS memberCount
FROM group WHERE fn::search(name, $query)
ORDER BY name COLLATE
LIMIT 60 START ($page - 1) * 60;

count(SELECT 1 FROM group WHERE fn::search(name, $query));
