# a page of the audit log, newest first, then how many pages there are
SELECT
	action,
	created,
	note,
	(
		SELECT
			status,
			username
		FROM $parent.user
	)[0] AS user
FROM auditLog
ORDER BY created DESC
LIMIT 100 START ($page - 1) * 100;

fn::clampPages(count(SELECT 1 FROM auditLog), 100);
