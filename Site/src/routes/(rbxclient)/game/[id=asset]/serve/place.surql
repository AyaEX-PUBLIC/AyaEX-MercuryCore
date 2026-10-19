SELECT
	record::id(id) AS id,
	serverPort,
	serverTicket,
	(SELECT VALUE username FROM $parent<-ownsPlace<-user)[0] AS owner
FROM $place;
