-- The destructive mirror of your migrations, run when the feature is removed.
-- Ship it as soon as you ship a migration: without it, uninstalling leaves
-- tables nothing will ever read again.
--
-- Children first: a foreign key would refuse the other order.
DROP TABLE IF EXISTS ft_counter_notes;
