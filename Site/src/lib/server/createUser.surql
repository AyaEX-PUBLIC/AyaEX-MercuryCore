BEGIN TRANSACTION;

# Take one use of the invite first: if two people register with its last use
# at once, one of them gets nothing, rather than both getting an account
IF $key {
	IF array::len(UPDATE $key SET usesLeft -= 1
		WHERE usesLeft > 0 AND (!expiry OR expiry > time::now())) = 0 {
		THROW "This invite has already been used";
	};
};

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
	RELATE $u->used->$key;
};

COMMIT TRANSACTION;
