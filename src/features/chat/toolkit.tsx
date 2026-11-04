import { defineToolkit } from '@assistant-ui/react';
import CohortToolUI from './tools/CohortToolUI';
import GeneClusteringToolUI from './tools/GeneClusteringToolUI';
import LollipopToolUI from './tools/LollipopToolUI';
import OncoMatrixToolUI from './tools/OncoMatrixToolUI';
import SurvivalToolUI from './tools/SurvivalToolUI';
import ToolCallFallback from './tools/ToolCallRow';

/** The agent's tools, by Gateway name. They run on the agent, so each entry only renders. */
export const toolkit = defineToolkit({
  'virtual-lab___check_virtual_lab_health': { type: 'backend', render: ToolCallFallback },
  'virtual-lab___update_cohort': { type: 'backend', render: CohortToolUI },
  'virtual-lab___show_oncomatrix': { type: 'backend', display: 'standalone', render: OncoMatrixToolUI },
  'virtual-lab___show_lollipop': { type: 'backend', display: 'standalone', render: LollipopToolUI },
  'virtual-lab___show_survival': { type: 'backend', display: 'standalone', render: SurvivalToolUI },
  'virtual-lab___show_gene_clustering': { type: 'backend', display: 'standalone', render: GeneClusteringToolUI },
});
