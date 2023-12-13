CREATE TABLE entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  test_id INTEGER,
  word_or_sentence_from TEXT,
  word_or_sentence_to TEXT,
  FOREIGN KEY (test_id) REFERENCES tests(id)
);

