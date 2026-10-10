SELECT
	record::id(id) AS id,
	name,
	serverPing,
	clientVersion,
	count(SELECT 1 FROM $parent<-playing WHERE valid AND ping > time::now() - 35s) AS playerCount
FROM place WHERE fn::filterGames($this)
ORDER BY playerCount DESC, serverPing DESC
LIMIT 2 START ($page - 1) * 2;

math::max([math::ceil(<float> count(SELECT 1 FROM place WHERE fn::filterGames($this)) / 2), 1]);
