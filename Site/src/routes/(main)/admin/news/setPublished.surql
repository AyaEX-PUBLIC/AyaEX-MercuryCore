UPDATE type::record("news", $id) SET
	published = $published ?? NONE,
	updated = time::now();
fn::auditLog("Administration", $note, $user);
