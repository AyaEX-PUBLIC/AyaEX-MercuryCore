# a ping only keeps a current session alive; it can't bring back an old one
UPDATE $playing SET ping = time::now() WHERE ping > time::now() - 5m;
