import { Button, Space } from "antd";
import type { ReactNode } from "react";

import { tokens } from "@theme/tokens";

type Props = {
  /** Primary submit button label. */
  submitText?: ReactNode;
  /** Cancel / secondary button label. */
  cancelText?: ReactNode;
  /** Cancel handler — when omitted the secondary button is hidden. */
  onCancel?: () => void;
  /** Optional explicit submit handler (defaults to `htmlType="submit"`). */
  onSubmit?: () => void;
  /** Show the spinner on submit. */
  loading?: boolean;
  /** Disable the submit button. */
  disabled?: boolean;
  /** Render extra elements left-aligned (e.g. autosave hints, validators). */
  extra?: ReactNode;
  /** Stick to the bottom of the viewport when scrolling. Default `false`. */
  sticky?: boolean;
};

/**
 * Standard footer for forms — keeps submit/cancel buttons aligned and
 * styled consistently across pages. Pair with `<Form onFinish>` to keep
 * keyboard submit working.
 */
export const SubmitBar = ({
  submitText = "Save",
  cancelText = "Cancel",
  onCancel,
  onSubmit,
  loading,
  disabled,
  extra,
  sticky,
}: Props) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "12px 0",
      gap: 12,
      flexWrap: "wrap",
      ...(sticky
        ? {
            position: "sticky",
            bottom: 0,
            background: tokens.color.surface,
            borderTop: `1px solid ${tokens.color.border}`,
            paddingLeft: 16,
            paddingRight: 16,
            zIndex: 2,
          }
        : {}),
    }}
  >
    <div>{extra}</div>
    <Space size={8}>
      {onCancel && (
        <Button onClick={onCancel} disabled={loading}>
          {cancelText}
        </Button>
      )}
      <Button
        type="primary"
        htmlType={onSubmit ? "button" : "submit"}
        loading={loading}
        disabled={disabled}
        onClick={onSubmit}
      >
        {submitText}
      </Button>
    </Space>
  </div>
);

export default SubmitBar;
