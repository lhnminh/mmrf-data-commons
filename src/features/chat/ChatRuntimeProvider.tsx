import React, { useMemo, useRef } from 'react';
import { AssistantRuntimeProvider, useLocalRuntime } from '@assistant-ui/react';
import { useCoreSelector } from '@gen3/core';
import { CASE_CENTRIC_INDEX } from '@/core';
import {
  buildCohortGqlOperator,
  selectCurrentCohortCaseFilters,
} from '@/core/utils';
import { createAgentAdapter } from './agentAdapter';

interface ChatRuntimeProviderProps {
  readonly children: React.ReactNode;
}

const ChatRuntimeProvider: React.FC<ChatRuntimeProviderProps> = ({
  children,
}: ChatRuntimeProviderProps) => {
  const cohortFilters = useCoreSelector((state) =>
    selectCurrentCohortCaseFilters(state, CASE_CENTRIC_INDEX),
  );
  const cohortFiltersRef = useRef(cohortFilters);
  cohortFiltersRef.current = cohortFilters;

  const adapter = useMemo(
    () =>
      createAgentAdapter(() => buildCohortGqlOperator(cohortFiltersRef.current)),
    [],
  );
  const runtime = useLocalRuntime(adapter);

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      {children}
    </AssistantRuntimeProvider>
  );
};

export default ChatRuntimeProvider;
