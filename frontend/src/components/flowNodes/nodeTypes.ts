import type { NodeTypes } from "@xyflow/react";

import StepNode, { type StepNodeKind } from "./StepNode";

/**
 * Map every flow runtime to the {@link StepNode} `kind` so the canvas
 * gets a per-runtime accent color and icon. A small lookup that's worth
 * exporting because the no-code designer + AI generator both need it.
 */
export const RUNTIME_KIND: Record<string, StepNodeKind> = {
  PLAYWRIGHT: "ui",
  PYTEST_API: "api",
  SQL: "sql",
};

/**
 * The single `nodeTypes` map every `<ReactFlow />` instance should plug in.
 *
 * @example
 *   <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes}>
 */
export const nodeTypes: NodeTypes = {
  step: StepNode,
};
