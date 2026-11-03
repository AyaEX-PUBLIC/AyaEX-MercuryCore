# A page of the user's friends, alphabetically (union, not concat: two people
# can't be listed twice)
SELECT status, username FROM (
	SELECT status, username
	FROM array::union($id->friends->user, $id<-friends<-user)
)
ORDER BY username COLLATE
LIMIT 60 START ($page - 1) * 60;
count(array::union($id->friends->user, $id<-friends<-user));
