# A page of the user's items of some types, newest first. (ORDER BY is
# ignored when selecting from graph edges in SurrealDB 3.0.1, so they're
# sorted outside.)
SELECT name, price, id, type, created FROM (
	SELECT
		out.name AS name,
		out.price AS price,
		record::id(out) AS id,
		out.type AS type,
		created
	FROM $user->ownsAsset
	WHERE out.type IN $types
)
ORDER BY created DESC
LIMIT 50 START ($page - 1) * 50;

fn::clampPages(
	count(SELECT 1 FROM $user->ownsAsset WHERE out.type IN $types),
	50
);
