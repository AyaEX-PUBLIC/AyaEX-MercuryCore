DELETE session WHERE $user IN <-hasSession<-user;
# an approved but unredeemed device code would make a new session
DELETE deviceCode WHERE user = $user;
