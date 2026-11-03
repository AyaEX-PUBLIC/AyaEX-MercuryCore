# a page of results, alphabetically, then how many there are
SELECT status, username FROM user WHERE fn::search(username, $query)
ORDER BY username COLLATE
LIMIT 60 START ($page - 1) * 60;

count(SELECT 1 FROM user WHERE fn::search(username, $query));
