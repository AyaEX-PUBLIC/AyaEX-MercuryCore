# union, not concat: two people can't be listed twice
SELECT status, username FROM array::union($id->friends->user, $id<-friends<-user);
count(array::union($id->friends->user, $id<-friends<-user));
