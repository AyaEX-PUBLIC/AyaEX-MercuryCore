SELECT username, status, !!authKey AS hasPhrase
FROM user
WHERE id NOT IN (
	SELECT VALUE out
	FROM moderation
	WHERE active = true
);
