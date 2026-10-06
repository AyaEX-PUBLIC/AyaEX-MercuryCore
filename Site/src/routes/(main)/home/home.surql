SELECT
	record::id(id) AS id,
	name,
	serverPing,
	count(
		SELECT 1 FROM $parent<-playing WHERE valid AND ping > time::now() - 35s
	) AS playerCount,
	count(<-likes) AS likeCount,
	count(<-dislikes) AS dislikeCount
FROM place WHERE !privateServer AND !deleted;

# Friends
# a friendship is stored one way (from whoever sent the request), so both
# directions; "a OR b" would only return the first non-empty list
SELECT status, username FROM array::union($user->friends->user, $user<-friends<-user);

# Feed
SELECT
	record::id(id) AS id,
	author,
	created,
	pinned,
	# count(
	# 	SELECT 1
	# 	FROM comment WHERE type = ["status", record::id($parent.id)]
	# )
	0 AS replies,
	visibility,
	fn::currentContent($this.content) AS currentContent
FROM comment WHERE type = ["status"]
ORDER BY pinned DESC, created DESC
LIMIT 40;
