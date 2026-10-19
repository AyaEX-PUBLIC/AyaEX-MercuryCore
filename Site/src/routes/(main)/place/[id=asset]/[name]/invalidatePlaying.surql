# keep at most one session per place the user is in: drop finished ones
# (nothing accepts a session last pinged over 5 minutes ago) and any earlier
# one for this place, then invalidate the rest
DELETE $user->playing WHERE out = $place OR ping < time::now() - 5m RETURN NONE;
UPDATE $user->playing SET valid = false RETURN NONE;
# remember the private link this session was opened with, so making the place
# private or regenerating its link ends the session's join and streaming rights
RELATE $user->playing->$place SET privateTicket = $privateTicket RETURN VALUE record::id(id);
