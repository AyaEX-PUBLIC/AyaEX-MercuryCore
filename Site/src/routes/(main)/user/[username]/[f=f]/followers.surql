# A page of the people following the user, alphabetically
SELECT status, username FROM (SELECT status, username FROM $id<-follows<-user)
ORDER BY username COLLATE
LIMIT 60 START ($page - 1) * 60;
count($id<-follows<-user);
