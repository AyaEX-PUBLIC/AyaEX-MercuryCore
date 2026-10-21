(CREATE ONLY type::record("news", rand::id()) CONTENT {
	author: $user,
	body: $body,
	cover: $cover,
	excerpt: $excerpt,
	published: $published ?? NONE,
	title: $title,
} RETURN VALUE record::id(id));
fn::auditLog("Administration", $note, $user);
