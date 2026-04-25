import { ArrowLeftOutlined, ArrowRightOutlined, BookOutlined, SearchOutlined } from "@ant-design/icons";
import { Button, Card, Empty, Input, Space, Tag, Typography } from "antd";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { ROUTES } from "@constants/routes";
import { DEFAULT_DOC_SLUG, DOCS, DOC_GROUPS, findDoc } from "@docs/index";
import DocsTOC from "@features/docs/DocsTOC";
import MarkdownView from "@features/docs/MarkdownView";
import { tokens } from "@theme/tokens";

const { Text, Title } = Typography;

const DocsPage = () => {
  const navigate = useNavigate();
  const { slug } = useParams<{ slug?: string }>();
  const [query, setQuery] = useState("");

  const activeSlug = slug ?? DEFAULT_DOC_SLUG;
  const active = findDoc(activeSlug);

  // Redirect missing slug to default. We do it as an effect so deep-linking
  // to a removed doc doesn't crash the UI — it just falls back to overview.
  useEffect(() => {
    if (!active) navigate(ROUTES.DOCS_PAGE(DEFAULT_DOC_SLUG), { replace: true });
  }, [active, navigate]);

  // Scroll to top when switching docs.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [activeSlug]);

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    return DOC_GROUPS.map((group) => ({
      group,
      items: DOCS.filter(
        (d) =>
          d.group === group &&
          (!q ||
            d.title.toLowerCase().includes(q) ||
            d.description.toLowerCase().includes(q) ||
            d.body.toLowerCase().includes(q)),
      ),
    })).filter((g) => g.items.length > 0);
  }, [query]);

  const flatList = useMemo(() => grouped.flatMap((g) => g.items), [grouped]);
  const activeIdxInFlat = flatList.findIndex((d) => d.slug === activeSlug);
  const prevDoc = activeIdxInFlat > 0 ? flatList[activeIdxInFlat - 1] : undefined;
  const nextDoc =
    activeIdxInFlat >= 0 && activeIdxInFlat < flatList.length - 1
      ? flatList[activeIdxInFlat + 1]
      : undefined;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "260px minmax(0, 1fr) 220px", gap: 24 }}>
      {/* ---------------- LEFT: doc index ---------------- */}
      <motion.aside
        initial={{ opacity: 0, x: -16 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.35, ease: tokens.motion.ease }}
        style={{ position: "sticky", top: 88, alignSelf: "start" }}
      >
        <Card
          bordered={false}
          style={{
            background: tokens.color.surface,
            borderRadius: tokens.radius.lg,
            boxShadow: tokens.shadow.sm,
          }}
          bodyStyle={{ padding: 16 }}
        >
          <Space direction="vertical" size={12} style={{ width: "100%" }}>
            <Space align="center" size={8}>
              <BookOutlined style={{ color: tokens.color.primary }} />
              <Text strong style={{ fontSize: 14 }}>
                Documentation
              </Text>
            </Space>
            <Input
              size="small"
              allowClear
              placeholder="Search docs"
              prefix={<SearchOutlined style={{ color: tokens.color.textFaint }} />}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {grouped.length === 0 ? (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={<span style={{ fontSize: 12 }}>No matches</span>}
                style={{ padding: "8px 0" }}
              />
            ) : (
              <div style={{ display: "grid", gap: 14 }}>
                {grouped.map(({ group, items }) => (
                  <div key={group}>
                    <div
                      style={{
                        fontSize: 11,
                        textTransform: "uppercase",
                        letterSpacing: "0.12em",
                        color: tokens.color.textFaint,
                        margin: "4px 4px 6px",
                        fontWeight: 600,
                      }}
                    >
                      {group}
                    </div>
                    <div style={{ display: "grid", gap: 2 }}>
                      {items.map((d) => {
                        const isActive = d.slug === activeSlug;
                        return (
                          <button
                            key={d.slug}
                            onClick={() => navigate(ROUTES.DOCS_PAGE(d.slug))}
                            className="qf-focusable"
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 10,
                              padding: "8px 10px",
                              borderRadius: 8,
                              border: "none",
                              cursor: "pointer",
                              textAlign: "left",
                              background: isActive
                                ? "linear-gradient(135deg, rgba(99,102,241,0.14), rgba(6,182,212,0.10))"
                                : "transparent",
                              color: isActive ? tokens.color.primary : tokens.color.text,
                              fontWeight: isActive ? 600 : 500,
                              fontSize: 13,
                              transition: "background 0.18s ease, color 0.18s ease",
                            }}
                            onMouseEnter={(e) => {
                              if (!isActive)
                                e.currentTarget.style.background = "rgba(99,102,241,0.06)";
                            }}
                            onMouseLeave={(e) => {
                              if (!isActive) e.currentTarget.style.background = "transparent";
                            }}
                          >
                            <span style={{ fontSize: 14, color: isActive ? tokens.color.primary : tokens.color.textMuted }}>
                              {d.icon}
                            </span>
                            <span style={{ flex: 1 }}>{d.title}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Space>
        </Card>
      </motion.aside>

      {/* ---------------- CENTER: rendered doc ---------------- */}
      <div style={{ minWidth: 0 }}>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: tokens.motion.ease }}
        >
          <Card
            bordered={false}
            style={{
              borderRadius: tokens.radius.xl,
              background: tokens.color.surface,
              boxShadow: tokens.shadow.md,
              overflow: "hidden",
            }}
            bodyStyle={{ padding: 0 }}
          >
            {/* Hero */}
            <div
              style={{
                padding: "28px 32px 22px",
                background: tokens.gradient.brandSoft,
                borderBottom: "1px solid rgba(99,102,241,0.12)",
              }}
            >
              <Space size={10} style={{ marginBottom: 10 }}>
                <Tag
                  color="purple"
                  style={{ borderRadius: 999, padding: "2px 10px", fontWeight: 500 }}
                >
                  {active?.group ?? ""}
                </Tag>
              </Space>
              <Title level={2} style={{ margin: 0, fontSize: 30, letterSpacing: "-0.02em" }}>
                <span className="qf-gradient-text">{active?.title ?? "Documentation"}</span>
              </Title>
              <Text type="secondary" style={{ fontSize: 14, display: "block", marginTop: 6 }}>
                {active?.description}
              </Text>
            </div>

            {/* Body */}
            <div style={{ padding: "28px 32px 32px" }}>
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeSlug}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.28 }}
                >
                  {active && <MarkdownView body={active.body} />}
                </motion.div>
              </AnimatePresence>

              {/* Prev / next */}
              {(prevDoc || nextDoc) && (
                <div
                  style={{
                    marginTop: 36,
                    paddingTop: 18,
                    borderTop: `1px solid ${tokens.color.border}`,
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 16,
                  }}
                >
                  {prevDoc ? (
                    <Button
                      block
                      size="large"
                      icon={<ArrowLeftOutlined />}
                      onClick={() => navigate(ROUTES.DOCS_PAGE(prevDoc.slug))}
                      style={{
                        height: "auto",
                        padding: "12px 16px",
                        textAlign: "left",
                        borderRadius: tokens.radius.md,
                      }}
                    >
                      <Space direction="vertical" size={0} style={{ alignItems: "flex-start" }}>
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          PREVIOUS
                        </Text>
                        <Text strong>{prevDoc.title}</Text>
                      </Space>
                    </Button>
                  ) : (
                    <span />
                  )}
                  {nextDoc && (
                    <Button
                      block
                      size="large"
                      type="primary"
                      onClick={() => navigate(ROUTES.DOCS_PAGE(nextDoc.slug))}
                      style={{
                        height: "auto",
                        padding: "12px 16px",
                        textAlign: "right",
                        borderRadius: tokens.radius.md,
                      }}
                    >
                      <Space direction="vertical" size={0} style={{ alignItems: "flex-end", width: "100%" }}>
                        <Text style={{ fontSize: 11, color: "rgba(255,255,255,0.85)" }}>NEXT</Text>
                        <Text strong style={{ color: "#fff" }}>
                          {nextDoc.title} <ArrowRightOutlined />
                        </Text>
                      </Space>
                    </Button>
                  )}
                </div>
              )}
            </div>
          </Card>
        </motion.div>
      </div>

      {/* ---------------- RIGHT: on-this-page TOC ---------------- */}
      <DocsTOC contentKey={activeSlug} />
    </div>
  );
};

export default DocsPage;
