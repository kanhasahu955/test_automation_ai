import type { CompiledFlow, Flow, FlowInput } from "@apptypes/api";

import { BaseApiClient } from "./BaseApiClient";

export class FlowApiClient extends BaseApiClient {
  list(projectId: string): Promise<Flow[]> {
    return this.get<Flow[]>(`/projects/${projectId}/flows`);
  }

  create(projectId: string, payload: FlowInput): Promise<Flow> {
    return this.post<Flow, FlowInput>(`/projects/${projectId}/flows`, payload);
  }

  getById(id: string): Promise<Flow> {
    return this.get<Flow>(`/flows/${id}`);
  }

  update(id: string, payload: Partial<FlowInput>): Promise<Flow> {
    return this.put<Flow, Partial<FlowInput>>(`/flows/${id}`, payload);
  }

  compile(id: string): Promise<CompiledFlow> {
    return this.post<CompiledFlow>(`/flows/${id}/compile`);
  }

  run(id: string): Promise<unknown> {
    return this.post<unknown>(`/flows/${id}/run`);
  }
}

const client = new FlowApiClient();

export const flowApi = {
  list: (projectId: string) => client.list(projectId),
  create: (projectId: string, payload: FlowInput) => client.create(projectId, payload),
  get: (id: string) => client.getById(id),
  update: (id: string, payload: Partial<FlowInput>) => client.update(id, payload),
  compile: (id: string) => client.compile(id),
  run: (id: string) => client.run(id),
};
