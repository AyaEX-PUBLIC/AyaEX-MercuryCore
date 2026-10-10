SELECT
	record::id(id) AS id,
	name,
	fn::currentContent($this.description) AS description,
	count(SELECT 1 FROM $parent<-playing WHERE valid AND ping > time::now() - 35s) AS playerCount
FROM place
WHERE fn::search(name, $query) AND fn::filterGames($this)
LIMIT 50;
