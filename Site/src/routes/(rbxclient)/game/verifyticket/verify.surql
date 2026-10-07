# the ticket's account, if it was issued for this place in the last five minutes;
# the ticket is spent either way
LET $found = (SELECT user.username AS username FROM $ticket
	WHERE place = $place AND created > time::now() - 5m)[0];
DELETE $ticket;
RETURN $found;
