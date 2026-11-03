# adds or removes one person's reaction, then returns everyone's
IF $add {
	RELATE $user->reacted->$shout CONTENT { emoji: $emoji };
} ELSE {
	DELETE $shout<-reacted[WHERE in = $user AND emoji = $emoji];
};
RETURN $shout<-reacted.{ emoji, user: record::id(in), username: in.username, created };
