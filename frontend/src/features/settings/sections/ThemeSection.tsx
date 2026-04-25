import { BulbOutlined, CompressOutlined, ExpandOutlined, MoonOutlined, SunOutlined } from "@ant-design/icons";
import { Card, Radio, Segmented, Space, Typography } from "antd";

import { useAppDispatch, useAppSelector } from "@app/store";
import FormSection from "@components/forms/FormSection";
import {
  ACCENT_PRESETS,
  setAccent,
  setDensity,
  setThemeMode,
  type ThemeDensity,
  type ThemeMode,
} from "@features/theme/themeSlice";
import { tokens } from "@theme/tokens";

const { Text, Paragraph } = Typography;

/**
 * Runtime theme controls — mode (light/dark), accent colour, and layout
 * density. Backed by the persisted `theme` slice so the choice survives
 * reloads and restarts.
 */
export const ThemeSection = () => {
  const dispatch = useAppDispatch();
  const theme = useAppSelector((s) => s.theme);

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <Card>
        <FormSection
          title={
            <Space>
              <BulbOutlined />
              Appearance
            </Space>
          }
          description="Pick a base mode. Switches apply instantly, no reload required."
        >
          <Segmented
            block
            value={theme.mode}
            onChange={(value) => dispatch(setThemeMode(value as ThemeMode))}
            options={[
              { value: "light", label: <Space><SunOutlined />Light</Space> },
              { value: "dark", label: <Space><MoonOutlined />Dark</Space> },
            ]}
          />
        </FormSection>

        <FormSection
          title="Accent colour"
          description="Used for primary buttons, highlights, links and progress bars."
          withDivider
        >
          <Space wrap size={12}>
            {ACCENT_PRESETS.map((preset) => {
              const active = theme.accent === preset.value;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => dispatch(setAccent(preset.value))}
                  aria-label={preset.label}
                  aria-pressed={active}
                  style={{
                    width: 64,
                    height: 64,
                    border: active
                      ? `2px solid ${preset.value}`
                      : `2px solid transparent`,
                    borderRadius: tokens.radius.md,
                    background: "transparent",
                    cursor: "pointer",
                    padding: 0,
                    transition: "transform 200ms ease",
                    transform: active ? "scale(1.04)" : "scale(1)",
                  }}
                >
                  <div
                    style={{
                      width: "100%",
                      height: "100%",
                      borderRadius: tokens.radius.sm,
                      background: preset.value,
                      boxShadow: active ? `0 8px 24px -8px ${preset.value}` : "none",
                    }}
                  />
                </button>
              );
            })}
          </Space>
          <Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0, fontSize: 12 }}>
            Current accent: <Text code>{theme.accent}</Text>
          </Paragraph>
        </FormSection>

        <FormSection
          title="Density"
          description="Compact density tightens spacing in lists, tables and forms — useful on smaller screens."
          withDivider
        >
          <Radio.Group
            value={theme.density}
            onChange={(e) => dispatch(setDensity(e.target.value as ThemeDensity))}
          >
            <Radio.Button value="comfortable">
              <Space><ExpandOutlined />Comfortable</Space>
            </Radio.Button>
            <Radio.Button value="compact">
              <Space><CompressOutlined />Compact</Space>
            </Radio.Button>
          </Radio.Group>
        </FormSection>
      </Card>
    </Space>
  );
};

export default ThemeSection;
