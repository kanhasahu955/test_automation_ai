/**
 * Table primitives.
 *
 * - {@link DataTable}: typed wrapper around AntD's `<Table />` that adds a
 *   toolbar, optional client-side search, refresh and a friendly empty state.
 * - {@link idColumn}, {@link statusColumn}, {@link dateColumn},
 *   {@link numberColumn}, {@link tagsColumn}: column factories so feature
 *   pages stop re-implementing the same render functions.
 */
export { default as DataTable } from "./DataTable";
export {
  idColumn,
  statusColumn,
  dateColumn,
  numberColumn,
  tagsColumn,
} from "./columns";
