# the session the user opened with Play (?/join) for this place, if recent:
# its ping is set then, and kept fresh by the gameserver while they're playing
LET $edge = (SELECT id, ping FROM playing
	WHERE in = $user AND out = $place
	ORDER BY ping DESC LIMIT 1)[0];
RETURN IF $edge AND $edge.ping > time::now() - 5m { $edge.id } ELSE { NONE };
