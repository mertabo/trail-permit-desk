DROP TABLE IF EXISTS smoke_tmp;
CREATE TABLE smoke_tmp (id SERIAL PRIMARY KEY, message TEXT NOT NULL);
INSERT INTO smoke_tmp (message) VALUES ('Hello from Postgres');
