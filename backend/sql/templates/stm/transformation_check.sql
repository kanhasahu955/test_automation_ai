-- TRANSFORMATION_CHECK: rows where the rendered transformation rule disagrees with the actual target value.
-- Variables: src_table, tgt_table, join_key, tgt_col, expected
SELECT s.{join_key},
       {expected} AS expected_value,
       t.{tgt_col} AS actual_value
FROM {src_table} s
JOIN {tgt_table} t ON s.{join_key} = t.{join_key}
WHERE {expected} <> t.{tgt_col};
