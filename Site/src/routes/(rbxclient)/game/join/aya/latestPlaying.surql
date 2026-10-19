# the session the user opened with Play (?/join) for this place, if recent:
# its ping is set then, and kept fresh by the gameserver while they're playing.
# Pings don't check access, so check it here: the place is public, the user
# owns it, or the private link they pressed Play with is still the current one.
# (Traverse from the user: filtering the whole table scans every session.)
LET $edge = (SELECT id, ping, privateTicket,
		out.privateServer AS privateServer,
		out.privateTicket AS currentTicket,
		$user IN out<-ownsPlace<-user AS owner
	FROM $user->playing
	WHERE out = $place
	ORDER BY ping DESC LIMIT 1)[0];
RETURN IF $edge AND $edge.ping > time::now() - 5m
	AND (!$edge.privateServer OR $edge.owner OR $edge.privateTicket = $edge.currentTicket)
	{ $edge.id } ELSE { NONE };
