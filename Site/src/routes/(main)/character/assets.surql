# A page of the user's wearable items of some types, newest first. (ORDER BY
# is ignored when selecting from graph edges in SurrealDB 3.0.1, so they're
# sorted outside.)
SELECT id, name, price, type, wearing, created FROM (
	SELECT
		record::id(out) AS id,
		out.name AS name,
		out.price AS price,
		out.type AS type,
		($user IN out<-wearing<-user) AS wearing,
		created
	FROM $user->ownsAsset
	WHERE out.type IN $types AND out.visibility = "Visible"
)
ORDER BY created DESC
LIMIT 50 START ($page - 1) * 50;

fn::clampPages(
	count(
		SELECT 1 FROM $user->ownsAsset
		WHERE out.type IN $types AND out.visibility = "Visible"
	),
	50
);
