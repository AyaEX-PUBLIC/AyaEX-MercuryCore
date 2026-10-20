LET $place = CREATE ONLY place CONTENT {
	id: $id,
	description: [{
		text: $description,
	}],
	maxPlayers: $maxPlayers,
	name: $name,
	privateServer: $privateServer,
	rigType: $rigType,
	clientVersion: $clientVersion,
	serverAddress: $serverAddress,
	serverPort: $serverPort,
};
RELATE $user->ownsPlace->$place;
