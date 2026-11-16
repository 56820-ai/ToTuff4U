-- Materialize the leaderboard podium so normal leaderboard page loads
-- read at most three precomputed rows per game, rather than scanning scores.
-- Run once after the existing scores table and score history are in place.

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

-- Seed ordinary games (preserves the existing per-score ranking behavior).
INSERT OR REPLACE INTO leaderboard_top_scores(game_key,rank,id,player_name,game_title,score,created_at)
WITH base AS (
 SELECT id,player_name,game_title,score,created_at,lower(trim(game_title)) game_key,
 CASE WHEN ltrim(score,'0')='' THEN '0' ELSE ltrim(score,'0') END normalized_score
 FROM scores
 WHERE lower(trim(game_title)) NOT IN ('cookie clicker','minecraft','retro bowl time','blocky combat swat time')
 AND (lower(trim(game_title))<>'slope' OR CAST(score AS INTEGER)<=1500)
), ranked AS (
 SELECT *,ROW_NUMBER() OVER(PARTITION BY game_key ORDER BY length(normalized_score) DESC,normalized_score DESC,created_at DESC,id ASC) game_rank
 FROM base
)
SELECT game_key,game_rank,id,player_name,game_title,score,created_at FROM ranked WHERE game_rank<=3;

-- Cookie Clicker keeps each player's personal best before selecting the podium.
INSERT OR REPLACE INTO leaderboard_top_scores(game_key,rank,id,player_name,game_title,score,created_at)
WITH base AS (
 SELECT id,player_name,game_title,score,created_at,lower(trim(player_name)) player_key,
 CASE WHEN ltrim(score,'0')='' THEN '0' ELSE ltrim(score,'0') END normalized_score
 FROM scores WHERE lower(trim(game_title))='cookie clicker'
), per_player AS (
 SELECT *,ROW_NUMBER() OVER(PARTITION BY player_key ORDER BY length(normalized_score) DESC,normalized_score DESC,created_at DESC,id ASC) player_rank
 FROM base
), ranked AS (
 SELECT *,ROW_NUMBER() OVER(ORDER BY length(normalized_score) DESC,normalized_score DESC,created_at DESC,id ASC) game_rank
 FROM per_player WHERE player_rank=1
)
SELECT 'cookie clicker',game_rank,id,player_name,game_title,score,created_at FROM ranked WHERE game_rank<=3;

-- Minecraft, Retro Bowl and Blocky Combat SWAT use accumulated playtime.
INSERT OR REPLACE INTO leaderboard_top_scores(game_key,rank,id,player_name,game_title,score,created_at)
WITH base AS (
 SELECT id,player_name,game_title,score,created_at,lower(trim(game_title)) game_key,lower(trim(player_name)) player_key
 FROM scores WHERE lower(trim(game_title)) IN ('minecraft','retro bowl time','blocky combat swat time')
), totals AS (
 SELECT game_key,player_key,SUM(CAST(score AS INTEGER)) total_score,MAX(created_at) latest_created_at
 FROM base GROUP BY game_key,player_key
), latest AS (
 SELECT t.game_key,t.player_key,t.total_score,t.latest_created_at,
 (SELECT b.id FROM base b WHERE b.game_key=t.game_key AND b.player_key=t.player_key ORDER BY b.created_at DESC,b.id ASC LIMIT 1) id,
 (SELECT b.player_name FROM base b WHERE b.game_key=t.game_key AND b.player_key=t.player_key ORDER BY b.created_at DESC,b.id ASC LIMIT 1) player_name,
 (SELECT b.game_title FROM base b WHERE b.game_key=t.game_key AND b.player_key=t.player_key ORDER BY b.created_at DESC,b.id ASC LIMIT 1) game_title
 FROM totals t
), ranked AS (
 SELECT *,ROW_NUMBER() OVER(PARTITION BY game_key ORDER BY total_score DESC,latest_created_at DESC,player_key ASC) game_rank FROM latest
)
SELECT game_key,game_rank,id,player_name,game_title,CAST(total_score AS TEXT),latest_created_at FROM ranked WHERE game_rank<=3;

-- Keep the ordinary-game podium current whenever a new score is submitted.
CREATE TRIGGER IF NOT EXISTS scores_refresh_normal_top3 AFTER INSERT ON scores
WHEN lower(trim(NEW.game_title)) NOT IN ('cookie clicker','minecraft','retro bowl time','blocky combat swat time')
BEGIN
 DELETE FROM leaderboard_top_scores WHERE game_key=lower(trim(NEW.game_title));
 INSERT INTO leaderboard_top_scores(game_key,rank,id,player_name,game_title,score,created_at)
 SELECT lower(trim(game_title)),ROW_NUMBER() OVER(ORDER BY length(CASE WHEN ltrim(score,'0')='' THEN '0' ELSE ltrim(score,'0') END) DESC,CASE WHEN ltrim(score,'0')='' THEN '0' ELSE ltrim(score,'0') END DESC,created_at DESC,id ASC),id,player_name,game_title,score,created_at
 FROM scores
 WHERE lower(trim(game_title))=lower(trim(NEW.game_title))
 AND (lower(trim(NEW.game_title))<>'slope' OR CAST(score AS INTEGER)<=1500)
 ORDER BY length(CASE WHEN ltrim(score,'0')='' THEN '0' ELSE ltrim(score,'0') END) DESC,CASE WHEN ltrim(score,'0')='' THEN '0' ELSE ltrim(score,'0') END DESC,created_at DESC,id ASC
 LIMIT 3;
END;

-- Keep Cookie Clicker's unique-player best-score podium current.
CREATE TRIGGER IF NOT EXISTS scores_refresh_cookie_top3 AFTER INSERT ON scores
WHEN lower(trim(NEW.game_title))='cookie clicker'
BEGIN
 DELETE FROM leaderboard_top_scores WHERE game_key='cookie clicker';
 INSERT INTO leaderboard_top_scores(game_key,rank,id,player_name,game_title,score,created_at)
 WITH per_player AS (
  SELECT *,ROW_NUMBER() OVER(PARTITION BY lower(trim(player_name)) ORDER BY length(CASE WHEN ltrim(score,'0')='' THEN '0' ELSE ltrim(score,'0') END) DESC,CASE WHEN ltrim(score,'0')='' THEN '0' ELSE ltrim(score,'0') END DESC,created_at DESC,id ASC) player_rank
  FROM scores WHERE lower(trim(game_title))='cookie clicker'
 ), ranked AS (
  SELECT *,ROW_NUMBER() OVER(ORDER BY length(CASE WHEN ltrim(score,'0')='' THEN '0' ELSE ltrim(score,'0') END) DESC,CASE WHEN ltrim(score,'0')='' THEN '0' ELSE ltrim(score,'0') END DESC,created_at DESC,id ASC) game_rank
  FROM per_player WHERE player_rank=1
 )
 SELECT 'cookie clicker',game_rank,id,player_name,game_title,score,created_at FROM ranked WHERE game_rank<=3;
END;

-- Keep the accumulated-playtime podium current.
CREATE TRIGGER IF NOT EXISTS scores_refresh_timed_top3 AFTER INSERT ON scores
WHEN lower(trim(NEW.game_title)) IN ('minecraft','retro bowl time','blocky combat swat time')
BEGIN
 DELETE FROM leaderboard_top_scores WHERE game_key=lower(trim(NEW.game_title));
 INSERT INTO leaderboard_top_scores(game_key,rank,id,player_name,game_title,score,created_at)
 WITH base AS (
  SELECT id,player_name,game_title,score,created_at,lower(trim(game_title)) game_key,lower(trim(player_name)) player_key
  FROM scores WHERE lower(trim(game_title))=lower(trim(NEW.game_title))
 ), totals AS (
  SELECT game_key,player_key,SUM(CAST(score AS INTEGER)) total_score,MAX(created_at) latest_created_at
  FROM base GROUP BY game_key,player_key
 ), latest AS (
  SELECT t.*,
   (SELECT b.id FROM base b WHERE b.player_key=t.player_key ORDER BY b.created_at DESC,b.id ASC LIMIT 1) id,
   (SELECT b.player_name FROM base b WHERE b.player_key=t.player_key ORDER BY b.created_at DESC,b.id ASC LIMIT 1) player_name,
   (SELECT b.game_title FROM base b WHERE b.player_key=t.player_key ORDER BY b.created_at DESC,b.id ASC LIMIT 1) game_title
  FROM totals t
 ), ranked AS (
  SELECT *,ROW_NUMBER() OVER(ORDER BY total_score DESC,latest_created_at DESC,player_key ASC) game_rank FROM latest
 )
 SELECT game_key,game_rank,id,player_name,game_title,CAST(total_score AS TEXT),latest_created_at FROM ranked WHERE game_rank<=3;
END;
