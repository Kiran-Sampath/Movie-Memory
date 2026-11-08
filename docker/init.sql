-- Runs once, the first time the container starts with an empty volume.
-- A separate database so tests can wipe tables without touching dev data.
CREATE DATABASE moviememory_test;
