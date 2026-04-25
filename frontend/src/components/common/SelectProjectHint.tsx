import { Alert } from "antd";

type Props = {
  /** Override the default copy. */
  message?: string;
  /** Set marginBottom; defaults to 16. */
  marginBottom?: number;
};

/**
 * Reusable info-strip shown when the current page needs a selected project.
 *
 * Replaces 7+ duplicated `<Alert type="info" message="Select a project to …" />`
 * blocks across feature pages.
 */
export const SelectProjectHint = ({
  message = "Select a project to continue.",
  marginBottom = 16,
}: Props) => (
  <Alert type="info" message={message} showIcon style={{ marginBottom }} />
);

export default SelectProjectHint;
