import type { SelectSamplesCallBackArg } from "./sjpp-types";
import { modals } from '@mantine/modals';

export const updateFilters = (arg: SelectSamplesCallBackArg) => {
  // ProteinPaint returns attribute mappings, not bare case IDs. Cohort filters
  // must contain scalar IDs so Guppy and ProteinPaint select the same cases.
  const caseIds = [...new Set(arg.samples.map(sample => sample["cases.case_id"])
    .filter((id): id is string => typeof id === 'string' && id.length > 0))];
  if (!caseIds.length) return;
  const filters = {
    case_centric: {
      mode: 'and',
      root: {
        case_id: {
          field: 'case_id',
          operands: caseIds,
          operator: 'in',
        },
      },
    },
  };

  modals.openContextModal({
    modal: "saveCohortModalMMRF",
    title: "Save Cohort",
    size: "md",
    zIndex: 1200,
    styles: {
      header: {
        marginLeft: "16px",
      },
    },
    innerProps: {
      filters,
    },
  });
};
