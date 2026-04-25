import { LockOutlined, MailOutlined } from "@ant-design/icons";
import { Alert, Button, Form, Input } from "antd";
import { useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import AuthLayout from "@components/common/AuthLayout";
import { ROUTES } from "@constants/routes";
import { useReduxErrorToast } from "@hooks/useReduxErrorToast";

import { useAuth } from "./useAuth";

type LoginValues = {
  email: string;
  password: string;
};

export const LoginPage = () => {
  const { login, isAuthenticated, status, error } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from =
    (location.state as { from?: Location })?.from?.pathname || ROUTES.DASHBOARD;

  useEffect(() => {
    if (isAuthenticated) navigate(from, { replace: true });
  }, [isAuthenticated, from, navigate]);

  useReduxErrorToast(error, status === "error");

  const onFinish = (values: LoginValues) => {
    login(values.email, values.password);
  };

  return (
    <AuthLayout
      title="QualityForge AI"
      subtitle="Sign in to continue to your workspace."
      footer={<>New here? <Link to={ROUTES.REGISTER}>Create an account</Link></>}
    >
      {error && status === "error" && (
        <Alert type="error" message={error} showIcon style={{ marginBottom: 16 }} />
      )}

      <Form<LoginValues> layout="vertical" onFinish={onFinish} requiredMark={false}>
        <Form.Item
          name="email"
          label="Email"
          rules={[
            { required: true, message: "Email is required" },
            { type: "email", message: "Enter a valid email address" },
          ]}
        >
          <Input prefix={<MailOutlined />} placeholder="you@company.com" autoComplete="email" />
        </Form.Item>
        <Form.Item
          name="password"
          label="Password"
          rules={[{ required: true, message: "Password is required" }]}
        >
          <Input.Password
            prefix={<LockOutlined />}
            placeholder="••••••••"
            autoComplete="current-password"
          />
        </Form.Item>
        <Form.Item>
          <Button
            type="primary"
            htmlType="submit"
            block
            size="large"
            loading={status === "loading"}
          >
            Sign in
          </Button>
        </Form.Item>
      </Form>
    </AuthLayout>
  );
};

export default LoginPage;
