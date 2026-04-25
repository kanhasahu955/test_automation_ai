-- NULL_CHECK validation: count NULLs in a target column.
-- Variables: tgt_table, tgt_col
SELECT COUNT(*) AS null_count FROM {tgt_table} WHERE {tgt_col} IS NULL;
