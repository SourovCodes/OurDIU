-- Full-text search over papers' text: an FTS5 index of `submission_texts` (external
-- content, keyed by submission id), kept in sync by the triggers below. Written by
-- hand (drizzle-kit doesn't model virtual tables); don't edit once applied.
-- `wrangler d1 export` refuses databases with virtual tables: drop this table, export,
-- then recreate it from this file and rebuild it with
-- INSERT INTO `submission_texts_fts`(`submission_texts_fts`) VALUES ('rebuild').
CREATE VIRTUAL TABLE `submission_texts_fts` USING fts5(
  `text`,
  content = 'submission_texts',
  content_rowid = 'submission_id',
  tokenize = 'porter unicode61 remove_diacritics 2'
);
--> statement-breakpoint
CREATE TRIGGER `submission_texts_after_insert` AFTER INSERT ON `submission_texts`
BEGIN
  INSERT INTO `submission_texts_fts`(`rowid`, `text`)
  VALUES (NEW.`submission_id`, NEW.`text`);
END;
--> statement-breakpoint
CREATE TRIGGER `submission_texts_after_delete` AFTER DELETE ON `submission_texts`
BEGIN
  INSERT INTO `submission_texts_fts`(`submission_texts_fts`, `rowid`, `text`)
  VALUES ('delete', OLD.`submission_id`, OLD.`text`);
END;
--> statement-breakpoint
CREATE TRIGGER `submission_texts_after_update` AFTER UPDATE OF `text` ON `submission_texts`
BEGIN
  INSERT INTO `submission_texts_fts`(`submission_texts_fts`, `rowid`, `text`)
  VALUES ('delete', OLD.`submission_id`, OLD.`text`);
  INSERT INTO `submission_texts_fts`(`rowid`, `text`)
  VALUES (NEW.`submission_id`, NEW.`text`);
END;
