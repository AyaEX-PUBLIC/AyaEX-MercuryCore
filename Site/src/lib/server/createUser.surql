LET $u = CREATE ONLY user CONTENT {
	authKey: $authKey,
	bodyColours: $bodyColours,
	email: $email,
	permissionLevel: $permissionLevel,
	phraseSet: time::now(),
	username: $username,
} RETURN VALUE id;
# Return some user data
$u;

IF $key {
	UPDATE $key SET usesLeft -= 1;
	RELATE $u->used->$key;
};
