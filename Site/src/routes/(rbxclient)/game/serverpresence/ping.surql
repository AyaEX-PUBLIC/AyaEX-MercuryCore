LET $place = (SELECT VALUE id FROM place WHERE serverTicket = $ticket)[0];
IF $place {
	UPDATE $place SET serverPing = time::unix();
	# the gameserver reports who is connected: keep each player's current
	# playing record alive (one that's still recent, so a ping can't bring back
	# an old visit), traversing from the place rather than the whole table
	FOR $username IN $players {
		LET $edge = (SELECT id, ping FROM $place<-playing
			WHERE in.username = $username AND ping > time::now() - 5m
			ORDER BY ping DESC LIMIT 1)[0].id;
		IF $edge {
			UPDATE $edge SET valid = true, ping = time::now();
		};
	};
};
# the reported players who joined through the website (playtime rewards)
RETURN IF $place THEN array::distinct(SELECT VALUE record::id(in) FROM $place<-playing
	WHERE in.username IN $players AND ping > time::now() - 10s) ELSE [] END;
