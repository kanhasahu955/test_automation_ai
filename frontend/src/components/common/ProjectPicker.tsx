import { ProjectOutlined } from "@ant-design/icons";
import { Select } from "antd";
import { useEffect, useMemo } from "react";

import { useAppDispatch, useAppSelector } from "@app/store";
import {
  fetchProjectsRequest,
  selectProject,
} from "@features/projects/projectsSlice";

export const ProjectPicker = () => {
  const dispatch = useAppDispatch();
  const items = useAppSelector((s) => s.projects.items);
  const selected = useAppSelector((s) => s.projects.selected);
  const loading = useAppSelector((s) => s.projects.loading);

  useEffect(() => {
    if (items.length === 0) dispatch(fetchProjectsRequest());
  }, [dispatch, items.length]);

  useEffect(() => {
    if (!selected && items.length > 0) {
      dispatch(selectProject(items[0]));
    }
  }, [items, selected, dispatch]);

  const options = useMemo(
    () => items.map((p) => ({ value: p.id, label: p.name })),
    [items],
  );

  return (
    <Select
      value={selected?.id}
      onChange={(value) => {
        const project = items.find((p) => p.id === value) || null;
        dispatch(selectProject(project));
      }}
      options={options}
      placeholder="Select project"
      style={{ minWidth: 220 }}
      loading={loading}
      suffixIcon={<ProjectOutlined />}
      notFoundContent={loading ? "Loading..." : "No projects yet"}
    />
  );
};

export default ProjectPicker;
