# a page of results, alphabetically, then how many there are
SELECT record::id(id) AS id, name, price FROM asset
WHERE visibility = "Visible" AND fn::search(name, $query) AND type IN [2, 8, 11, 12, 17, 18, 19]
ORDER BY name COLLATE
LIMIT 60 START ($page - 1) * 60;

count(
	SELECT 1 FROM asset
	WHERE visibility = "Visible" AND fn::search(name, $query) AND type IN [2, 8, 11, 12, 17, 18, 19]
);
