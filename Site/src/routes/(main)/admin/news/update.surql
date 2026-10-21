UPDATE type::record("news", $id) SET
	body = $body,
	cover = $cover,
	excerpt = $excerpt,
	published = $published ?? NONE,
	title = $title,
	updated = time::now();
fn::auditLog("Administration", $note, $user);
