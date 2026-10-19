# whether a player may use StreamingFrame signaling in a place: they're
# playing it now and may still enter it (as in
# routes/(rbxclient)/game/join/aya/latestPlaying.surql), and they aren't moderated
LET $edge = (SELECT ping, privateTicket,
		out.privateServer AS privateServer,
		out.privateTicket AS currentTicket,
		$user IN out<-ownsPlace<-user AS owner
	FROM $user->playing
	WHERE out = $place
	ORDER BY ping DESC LIMIT 1)[0];
LET $moderated = !!(SELECT 1 FROM moderation WHERE out = $user AND active);
RETURN IF $edge AND $edge.ping > time::now() - 5m AND !$moderated
	AND (!$edge.privateServer OR $edge.owner OR $edge.privateTicket = $edge.currentTicket)
	{ true } ELSE { false };
