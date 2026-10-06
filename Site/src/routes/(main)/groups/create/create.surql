LET $group = CREATE ONLY group SET name = $name;
RELATE $user->ownsGroup->$group;
RELATE $user->member->$group;
RETURN record::id($group.id);
