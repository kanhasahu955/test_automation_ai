-- ROW_COUNT validation: compare total counts between source and target tables.
-- Variables: src_table, tgt_table
SELECT (SELECT COUNT(*) FROM {src_table}) AS source_count,
       (SELECT COUNT(*) FROM {tgt_table}) AS target_count;
