-- REFERENCE_CHECK validation: target rows whose join key has no source counterpart.
-- Variables: src_table, tgt_table, join_key, tgt_col
SELECT t.{tgt_col} AS missing_reference
FROM {tgt_table} t
LEFT JOIN {src_table} s ON s.{join_key} = t.{join_key}
WHERE s.{join_key} IS NULL;
