-- DUPLICATE_CHECK validation: list values appearing more than once in a target column.
-- Variables: tgt_table, tgt_col
SELECT {tgt_col}, COUNT(*) AS dup_count
FROM {tgt_table}
GROUP BY {tgt_col}
HAVING COUNT(*) > 1;
