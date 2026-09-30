-- HarborWatch 3D seed. The API also applies schema on startup.
CREATE TABLE IF NOT EXISTS users (
  user_id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL,
  site_ids TEXT[] NOT NULL
);
