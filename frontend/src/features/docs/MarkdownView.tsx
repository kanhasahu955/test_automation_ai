import { CheckOutlined, CopyOutlined } from "@ant-design/icons";
import { Button, Tooltip, message } from "antd";
import { useState, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";

type MarkdownViewProps = {
  body: string;
};

const CodeBlock = ({ inline, className, children, ...rest }: {
  inline?: boolean;
  className?: string;
  children?: ReactNode;
}) => {
  const [copied, setCopied] = useState(false);

  if (inline) {
    return (
      <code className={className} {...rest}>
        {children}
      </code>
    );
  }

  const text = String(children ?? "").replace(/\n$/, "");

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      message.error("Could not copy to clipboard");
    }
  };

  return (
    <div style={{ position: "relative" }}>
      <Tooltip title={copied ? "Copied" : "Copy"}>
        <Button
          size="small"
          type="text"
          onClick={handleCopy}
          icon={copied ? <CheckOutlined /> : <CopyOutlined />}
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            color: copied ? "#10b981" : "#cbd5e1",
            background: "rgba(15,23,42,0.5)",
            backdropFilter: "blur(4px)",
            zIndex: 1,
          }}
        />
      </Tooltip>
      <pre>
        <code className={className} {...rest}>
          {children}
        </code>
      </pre>
    </div>
  );
};

/**
 * Renders the Markdown body of a doc with syntax-highlighted code blocks,
 * GFM tables/footnotes, anchor IDs on headings, and a copy button on code.
 */
export const MarkdownView = ({ body }: MarkdownViewProps) => (
  <article className="qf-markdown">
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeSlug, [rehypeHighlight, { detect: true, ignoreMissing: true }]]}
      components={{
        code: CodeBlock as never,
        a: (props) => <a {...props} target={props.href?.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer" />,
      }}
    >
      {body}
    </ReactMarkdown>
  </article>
);

export default MarkdownView;
