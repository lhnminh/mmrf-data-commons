import React from 'react';
import { AssistantRuntimeProvider, useLocalRuntime } from '@assistant-ui/react';
import { convertFilterSetToGqlFilter, useCoreSelector } from '@gen3/core';
import { COHORT_FILTER_INDEX } from '@/core';
import { selectCurrentCohortCaseFilters } from '@/core/utils';
import { createAgentAdapter } from './agentAdapter';

interface ChatRuntimeProviderProps {
  readonly children: React.ReactNode;
}

const ChatRuntimeProvider: React.FC<ChatRuntimeProviderProps> = ({
  children,
}: ChatRuntimeProviderProps) => {
  const cohort = useCoreSelector((state) => selectCurrentCohortCaseFilters(state, COHORT_FILTER_INDEX));
  const cohortFilter = convertFilterSetToGqlFilter(cohort) ?? null;
  const runtime = useLocalRuntime(createAgentAdapter(() => cohortFilter));

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      {children}
    </AssistantRuntimeProvider>
  );
};

export default ChatRuntimeProvider;
