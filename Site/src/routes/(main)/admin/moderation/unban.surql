# only the actor's own sanction, as the check before this requires
UPDATE moderation SET active = false WHERE in = $user AND out = $moderatee AND active = true;
fn::auditLog("Moderation", $note, $user);
