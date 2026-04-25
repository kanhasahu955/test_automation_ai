import { CheckOutlined, CopyOutlined } from "@ant-design/icons";
import { Button, Space, Tag, Tooltip, Typography, message } from "antd";
import { useState, type ReactNode } from "react";

import { tokens } from "@theme/tokens";

const { Text } = Typography;

type Props = {
  /** Source code / raw text to render. */
  code: string;
  /** Optional badge shown in the corner (e.g. "JSON", "SQL", "Python"). */
  language?: string;
  /** Caption displayed above the code. */
  title?: ReactNode;
  /** Cap the visible height; vertical scroll kicks in past this. Default 360. */
  maxHeight?: number;
  /** Hide the copy button. */
  noCopy?: boolean;
};

/**
 * Read-only dark code panel with a one-click copy action.
 *
 * Replaces inline `<pre style={{ background: '#0f172a', ... }}>` blocks
 * scattered across feature pages. Keeps the dark IDE-style look consistent.
 */
export const CodeBlock = ({
  code,
  language,
  title,
  maxHeight = 360,
  noCopy = false,
}: Props) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      message.success("Copied to clipboard");
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      message.error("Could not copy to clipboard");
    }
  };

  return (
    <div
      style={{
        borderRadius: tokens.radius.md,
        overflow: "hidden",
        border: "1px solid rgba(15, 23, 42, 0.06)",
        boxShadow: tokens.shadow.xs,
      }}
    >
      {(title || language || !noCopy) && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "8px 12px",
            background: "#1e293b",
            color: tokens.color.surface,
            borderBottom: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <Space size={8}>
            {title && (
              <Text style={{ color: tokens.color.surface, fontSize: 12, fontWeight: 600 }}>
                {title}
              </Text>
            )}
            {language && (
              <Tag color="geekblue" style={{ margin: 0, textTransform: "uppercase" }}>
                {language}
              </Tag>
            )}
          </Space>
          {!noCopy && (
            <Tooltip title={copied ? "Copied" : "Copy to clipboard"}>
              <Button
                size="small"
                type="text"
                onClick={handleCopy}
                icon={copied ? <CheckOutlined /> : <CopyOutlined />}
                style={{ color: tokens.color.surface }}
              />
            </Tooltip>
          )}
        </div>
      )}
      <pre
        style={{
          margin: 0,
          padding: 16,
          fontFamily:
            "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace",
          fontSize: 12,
          lineHeight: 1.55,
          background: "#0f172a",
          color: "#e2e8f0",
          maxHeight,
          overflow: "auto",
        }}
      >
        {code}
      </pre>
    </div>
  );
};

export default CodeBlock;
