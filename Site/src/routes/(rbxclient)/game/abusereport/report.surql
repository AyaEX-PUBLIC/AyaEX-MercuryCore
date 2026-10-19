# reports this player sent recently, from the website or in game
LET $recent = (SELECT VALUE id FROM report
	WHERE in = $reporter AND time > time::now() - 10m);
IF array::len($recent) < $maxReports {
	RELATE $reporter->report->$reportee CONTENT {
		category: $category,
		note: $note,
		url: $url,
	};
};
