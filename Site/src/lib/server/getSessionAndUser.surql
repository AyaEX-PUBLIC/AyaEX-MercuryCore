LET $s = SELECT id, expires FROM ONLY $sess;
LET $u = (SELECT
    record::id(id) AS id,
	fn::currentContent($this.description) AS description,
    bodyColours,
    # created,
    IF email {
		string::concat("*******@", parse::email::host(email)) 
	} ELSE {
		""
	} AS email,
    lastOnline,
    permissionLevel,
	!!authKey AS hasPhrase,
    css,
    clientChannel,
    theme,
	status,
	username
FROM $sess<-hasSession<-user)[0];

# an expired session is deleted and isn't valid, even for this request;
# one used within 15 days of expiring lasts another 30
IF $s {
	IF $s.expires < time::now() {
		DELETE $s.id;
	} ELSE IF $s.expires - 15d < time::now() {
		UPDATE $s.id SET expires = time::now() + 30d;
	};
};

{
	session: IF $s AND $s.expires >= time::now() { record::id($s.id) } ELSE { NONE },
	user: IF $s AND $s.expires >= time::now() { $u } ELSE { NONE },
};

