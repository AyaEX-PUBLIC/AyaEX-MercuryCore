-- members and pending invites, for the group's managers
SELECT
	(SELECT status, username, created FROM <-member<-user ORDER BY username LIMIT 500) AS members,
	(SELECT out.username AS username, out.status AS status, inviter.username AS inviter, created
		FROM ->groupInvite ORDER BY created DESC) AS invites
FROM $group;
