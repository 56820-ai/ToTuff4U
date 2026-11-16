-- Arcade Atlas Cloudflare D1 schema.
-- Scores are TEXT so Cookie Clicker values up to 500 digits remain exact.
CREATE TABLE IF NOT EXISTS scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_name TEXT NOT NULL CHECK (length(player_name) BETWEEN 1 AND 24),
  game_title TEXT NOT NULL CHECK (length(game_title) BETWEEN 1 AND 60),
  score TEXT NOT NULL CHECK (length(score) BETWEEN 1 AND 500),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_scores_created_at
  ON scores(created_at DESC, id ASC);

CREATE INDEX IF NOT EXISTS idx_scores_game_title
  ON scores(game_title);

CREATE TABLE IF NOT EXISTS score_ip_records (
  score_id INTEGER PRIMARY KEY REFERENCES scores(id) ON DELETE CASCADE,
  ip_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);


-- Materialized leaderboard: one row per podium position per game.
-- GET /scores reads only these rows, never the complete score history.
CREATE TABLE IF NOT EXISTS leaderboard_top_scores (
  game_key TEXT NOT NULL,
  rank INTEGER NOT NULL CHECK(rank BETWEEN 1 AND 3),
  id INTEGER NOT NULL,
  player_name TEXT NOT NULL,
  game_title TEXT NOT NULL,
  score TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY(game_key, rank)
);
CREATE INDEX IF NOT EXISTS idx_leaderboard_top_scores_game_rank
  ON leaderboard_top_scores(game_key, rank);
