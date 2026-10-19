# whether a player may use StreamingFrame signaling in a place: they're
# playing it now (as in routes/(rbxclient)/game/join/aya/latestPlaying.surql),
# and they aren't moderated
LET $edge = (SELECT ping FROM playing
	WHERE in = $user AND out = $place
	ORDER BY ping DESC LIMIT 1)[0];
LET $moderated = !!(SELECT 1 FROM moderation WHERE out = $user AND active);
RETURN IF $edge AND $edge.ping > time::now() - 5m AND !$moderated { true } ELSE { false };
