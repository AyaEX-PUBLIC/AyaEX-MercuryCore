SELECT
	dedicated,
	fn::currentContent($this.description) AS description,
	record::id(id) AS id,
	maxPlayers,
	name,
	clientVersion,
	(SELECT status, username FROM $parent<-ownsPlace<-user)[0] AS owner,
	privateServer,
	privateTicket,
	rigType ?? "Both" AS rigType,
	serverAddress,
	serverPort,
	serverTicket
FROM $place;
