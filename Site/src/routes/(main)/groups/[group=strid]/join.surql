IF $user NOT IN $group<-member<-user {
	RELATE $user->member->$group;
};
DELETE $group->groupInvite WHERE out = $user;
