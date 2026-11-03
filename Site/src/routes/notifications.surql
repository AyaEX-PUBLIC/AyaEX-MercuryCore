# A page of the user's notifications (or only the unread ones), newest first,
# then how many there are
SELECT
	*,
	record::id(id) AS id,
	(SELECT status, username FROM $parent<-user)[0] AS sender
OMIT in, out
FROM notification WHERE out = $user AND (!$unreadOnly OR !read)
ORDER BY created DESC
LIMIT $size START $start;

count(SELECT 1 FROM notification WHERE out = $user AND (!$unreadOnly OR !read));
