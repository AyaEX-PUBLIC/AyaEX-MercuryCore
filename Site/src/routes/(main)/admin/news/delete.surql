DELETE type::record("news", $id);
fn::auditLog("Administration", $note, $user);
