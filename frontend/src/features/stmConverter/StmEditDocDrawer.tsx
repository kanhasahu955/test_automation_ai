import { Button, Drawer, Form, Input, Space, Typography } from "antd";
import { useEffect } from "react";

import { FormSection, required } from "@components/forms";
import type { StmDocument } from "@services/stmApi";

interface DocFormValues {
  file_name: string;
  notes?: string;
}

interface Props {
  open: boolean;
  saving: boolean;
  document?: StmDocument;
  onClose: () => void;
  onSubmit: (values: DocFormValues) => void;
}

/**
 * Right-hand drawer to rename / annotate an STM document.
 * Used both for active and completed documents — read-only on completed if needed.
 */
export const StmEditDocDrawer = ({ open, saving, document, onClose, onSubmit }: Props) => {
  const [form] = Form.useForm<DocFormValues>();

  useEffect(() => {
    if (open && document) {
      form.setFieldsValue({
        file_name: document.file_name,
        notes: document.notes ?? "",
      });
    }
  }, [open, document, form]);

  return (
    <Drawer
      title="Edit STM document"
      open={open}
      onClose={onClose}
      width={520}
      destroyOnHidden
      extra={
        <Space>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            type="primary"
            loading={saving}
            onClick={async () => {
              const values = await form.validateFields();
              onSubmit(values);
            }}
          >
            Save
          </Button>
        </Space>
      }
    >
      <Form<DocFormValues> layout="vertical" form={form}>
        <FormSection title="Identity" description="A clear, human-readable name helps you find it later.">
          <Form.Item name="file_name" label="Name" rules={[required("Name")]}>
            <Input placeholder="e.g. Customer dim STM v2" autoFocus />
          </Form.Item>
        </FormSection>
        <FormSection title="Notes" description="Context, owner, ticket links — anything future-you needs.">
          <Form.Item name="notes" label="Notes (optional)">
            <Input.TextArea rows={6} placeholder="Why this STM exists, what to watch for, links…" />
          </Form.Item>
        </FormSection>
        {document?.is_completed ? (
          <Typography.Paragraph type="secondary" style={{ marginTop: 8 }}>
            This document is marked complete. You can still rename and annotate it.
          </Typography.Paragraph>
        ) : null}
      </Form>
    </Drawer>
  );
};

export default StmEditDocDrawer;
