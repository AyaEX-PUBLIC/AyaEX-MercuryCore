# a page of results, alphabetically, then how many there are
SELECT
	record::id(id) AS id,
	name,
	serverPing,
	count(
		SELECT 1 FROM $parent<-playing WHERE valid AND ping > time::now() - 35s
	) AS playerCount,
	count(<-likes) AS likeCount,
	count(<-dislikes) AS dislikeCount
FROM place
WHERE fn::search(name, $query) AND fn::filterGames($this)
ORDER BY name COLLATE
LIMIT 60 START ($page - 1) * 60;

count(
	SELECT 1 FROM place WHERE fn::search(name, $query) AND fn::filterGames($this)
);
