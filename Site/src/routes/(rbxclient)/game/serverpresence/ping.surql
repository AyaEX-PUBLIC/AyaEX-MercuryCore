LET $place = (SELECT VALUE id FROM place WHERE serverTicket = $ticket)[0];
IF $place {
	UPDATE $place SET serverPing = time::unix();
	# the gameserver reports who is connected: keep each player's latest
	# playing record alive
	FOR $username IN $players {
		LET $edge = (SELECT id, ping FROM playing
			WHERE out = $place AND in.username = $username
			ORDER BY ping DESC LIMIT 1)[0].id;
		IF $edge {
			UPDATE $edge SET valid = true, ping = time::now();
		};
	};
};
