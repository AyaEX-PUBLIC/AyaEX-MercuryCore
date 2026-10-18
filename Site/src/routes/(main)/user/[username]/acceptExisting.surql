DELETE $user2->request WHERE out = $user;
# a request the other way is answered too
DELETE $user->request WHERE out = $user2;
# a leftover request between friends mustn't make a second friendship
IF $user NOT IN array::union($user2->friends->user, $user2<-friends<-user) {
	RELATE $user2->friends->$user;
	fn::notify($user, $user2, "NewFriend", $note, $relativeId);
};
