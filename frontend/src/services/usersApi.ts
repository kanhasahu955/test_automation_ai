import type { Page, User, UserRole } from "@apptypes/api";

import { BaseApiClient } from "./BaseApiClient";

export type UserCreateInput = {
  name: string;
  email: string;
  password: string;
  role?: UserRole;
};

export type UserUpdateInput = {
  name?: string;
  role?: UserRole;
  is_active?: boolean;
  password?: string;
};

/**
 * Domain client for `/users` — admin-gated CRUD for the user management
 * settings screen. Mirrors the backend pagination contract (`page` + `size`).
 */
export class UsersApiClient extends BaseApiClient {
  constructor() {
    super("/users");
  }

  list(page = 1, size = 20, search?: string): Promise<Page<User>> {
    return this.get<Page<User>>("", { params: { page, size, search } });
  }

  getById(id: string): Promise<User> {
    return this.get<User>(`/${id}`);
  }

  create(payload: UserCreateInput): Promise<User> {
    return this.post<User, UserCreateInput>("", payload);
  }

  update(id: string, payload: UserUpdateInput): Promise<User> {
    return this.put<User, UserUpdateInput>(`/${id}`, payload);
  }

  remove(id: string): Promise<void> {
    return this.delete<void>(`/${id}`);
  }
}

const client = new UsersApiClient();

export const usersApi = {
  list: (page = 1, size = 20, search?: string) => client.list(page, size, search),
  get: (id: string) => client.getById(id),
  create: (payload: UserCreateInput) => client.create(payload),
  update: (id: string, payload: UserUpdateInput) => client.update(id, payload),
  remove: (id: string) => client.remove(id),
};
