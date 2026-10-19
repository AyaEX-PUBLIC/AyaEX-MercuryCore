SELECT record::id(id) AS id, name, price FROM asset
WHERE visibility = "Visible" AND fn::search(name, $query) AND type IN [2, 8, 11, 12, 17, 18, 19];
