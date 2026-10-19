# the gameserver was closed: show the place offline and nobody playing
# straight away instead of waiting for the presence pings to time out
UPDATE $place SET serverPing = 0;
UPDATE $place<-playing SET valid = false;
