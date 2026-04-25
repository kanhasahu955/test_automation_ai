import { LockOutlined, MailOutlined, UserOutlined } from "@ant-design/icons";
import { Alert, Button, Form, Input } from "antd";
import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";

import AuthLayout from "@components/common/AuthLayout";
import { ROUTES } from "@constants/routes";
import { useReduxErrorToast } from "@hooks/useReduxErrorToast";

import { useAuth } from "./useAuth";

type RegisterValues = {
  name: string;
  email: string;
  password: string;
};

export const RegisterPage = () => {
  const { register, isAuthenticated, status, error } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) navigate(ROUTES.DASHBOARD, { replace: true });
  }, [isAuthenticated, navigate]);

  useReduxErrorToast(error, status === "error");

  const onFinish = (values: RegisterValues) => {
    register(values.name, values.email, values.password);
  };

  return (
    <AuthLayout
      title="Create an account"
      subtitle="Set up your workspace and start building tests in minutes."
      width={460}
      showLogo={false}
      footer={<>Already have an account? <Link to={ROUTES.LOGIN}>Sign in</Link></>}
    >
      {error && status === "error" && (
        <Alert type="error" message={error} showIcon style={{ marginBottom: 16 }} />
      )}

      <Form<RegisterValues> layout="vertical" onFinish={onFinish} requiredMark={false}>
        <Form.Item
          name="name"
          label="Full name"
          rules={[{ required: true, message: "Name is required" }]}
        >
          <Input prefix={<UserOutlined />} placeholder="Jane Doe" />
        </Form.Item>
        <Form.Item
          name="email"
          label="Work email"
          rules={[
            { required: true, message: "Email is required" },
            { type: "email", message: "Enter a valid email address" },
          ]}
        >
          <Input prefix={<MailOutlined />} placeholder="jane@company.com" />
        </Form.Item>
        <Form.Item
          name="password"
          label="Password"
          rules={[
            { required: true, message: "Password is required" },
            { min: 8, message: "Use at least 8 characters" },
          ]}
        >
          <Input.Password prefix={<LockOutlined />} placeholder="Min 8 characters" />
        </Form.Item>
        <Form.Item>
          <Button
            type="primary"
            htmlType="submit"
            block
            size="large"
            loading={status === "loading"}
          >
            Create account
          </Button>
        </Form.Item>
      </Form>
    </AuthLayout>
  );
};

export default RegisterPage;
