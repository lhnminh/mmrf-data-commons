import React, { useMemo, useRef } from 'react';
import { AssistantRuntimeProvider, useLocalRuntime } from '@assistant-ui/react';
import { useCoreSelector } from '@gen3/core';
import { buildCohortGqlOperator } from '@/core/utils';
import { createAgentAdapter } from './agentAdapter';
import { selectSelectedCohortFilterSet } from './selectedCohortFilter';

interface ChatRuntimeProviderProps {
  readonly children: React.ReactNode;
}

const ChatRuntimeProvider: React.FC<ChatRuntimeProviderProps> = ({
  children,
}: ChatRuntimeProviderProps) => {
  const cohortFilters = useCoreSelector(selectSelectedCohortFilterSet);
  const cohortFiltersRef = useRef(cohortFilters);
  cohortFiltersRef.current = cohortFilters;

  const adapter = useMemo(
    () => createAgentAdapter(() => buildCohortGqlOperator(cohortFiltersRef.current)),
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
