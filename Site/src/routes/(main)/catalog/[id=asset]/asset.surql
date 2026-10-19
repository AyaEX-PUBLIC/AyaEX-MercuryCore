SELECT
	name,
	visibility,
	(SELECT VALUE id FROM $parent<-created<-user)[0] = $user AS isCreator
FROM $asset;
