SELECT name, count(<-member) AS memberCount FROM $group;

# a page of the members, alphabetically
SELECT status, username FROM (SELECT status, username FROM $group<-member<-user)
ORDER BY username COLLATE
LIMIT 60 START ($page - 1) * 60;
