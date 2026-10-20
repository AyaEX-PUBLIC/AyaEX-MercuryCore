SELECT
	(
		SELECT
			record::id(id) AS id,
			dedicated,
			rigType,
			serverAddress,
			serverPort,
			serverTicket,
			(
				SELECT username
				FROM $parent<-ownsPlace<-user
			)[0] AS ownerUser
		FROM $parent->place
	)[0] AS place,
	(
		SELECT
			avatarRig,
			permissionLevel,
			username
		FROM $parent<-user
	)[0] AS user
FROM ONLY $playing;

UPDATE $playing SET valid = false;
