import { useEffect, useState } from "react";

import { flowApi } from "@services/flowApi";
import type { ScheduleTargetType } from "@services/scheduleApi";
import { stmApi } from "@services/stmApi";
import { testSuiteApi } from "@services/testSuiteApi";

export type TargetOption = { value: string; label: string };

/**
 * Fetch the candidate target ids for a given Schedule target type.
 *
 * Each target picker hits a different endpoint, so this hook centralises
 * the loading / error semantics for the form.
 */
export const useTargetOptions = (
  projectId: string | null | undefined,
  targetType: ScheduleTargetType,
) => {
  const [options, setOptions] = useState<TargetOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!projectId) {
      setOptions([]);
      return;
    }
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        let next: TargetOption[] = [];
        if (targetType === "TEST_SUITE") {
          const data = await testSuiteApi.list(projectId);
          next = data.map((s) => ({ value: s.id, label: s.name }));
        } else if (targetType === "NO_CODE_FLOW") {
          const data = await flowApi.list(projectId);
          next = data.map((f) => ({
            value: f.id,
            label: f.name ?? `Flow ${f.id.slice(0, 6)}`,
          }));
        } else if (targetType === "STM_DOCUMENT") {
          const data = await stmApi.listDocuments(projectId);
          next = data.map((d) => ({ value: d.id, label: d.file_name }));
        }
        if (!cancelled) setOptions(next);
      } catch {
        if (!cancelled) setOptions([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [projectId, targetType]);

  return { options, loading };
};
