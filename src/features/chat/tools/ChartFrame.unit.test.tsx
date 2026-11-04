import React from 'react';
import { render, screen } from '@testing-library/react';
import ChartFrame from './ChartFrame';

const mockFilter = jest.fn();

jest.mock('../useCohortSync', () => ({
  useCohortFilterForRevision: () => mockFilter(),
}));
jest.mock('@assistant-ui/react', () => ({ useAuiState: () => false }));

const COHORT = { label: 'Race: x', caseCount: 334, revision: 2 };

describe('ChartFrame', () => {
  it('captions the chart with its title and the cohort it ran on', () => {
    mockFilter.mockReturnValue({ and: [] });
    render(
      <ChartFrame title="OncoMatrix" cohort={COHORT}>
        {() => <div>chart</div>}
      </ChartFrame>,
    );
    expect(screen.getByText('OncoMatrix')).toBeTruthy();
    expect(screen.getByText('on Race: x, 334 cases')).toBeTruthy();
  });

  it('renders the footer under the chart', () => {
    mockFilter.mockReturnValue({ and: [] });
    render(
      <ChartFrame cohort={COHORT} footer={<button type="button">Lollipop for KRAS</button>}>
        {() => <div>chart</div>}
      </ChartFrame>,
    );
    expect(screen.getByRole('button', { name: 'Lollipop for KRAS' })).toBeTruthy();
  });

  it('keeps the missing-cohort note', () => {
    mockFilter.mockReturnValue(undefined);
    render(<ChartFrame cohort={COHORT}>{() => <div>chart</div>}</ChartFrame>);
    expect(screen.getByText("This chart's cohort is no longer available")).toBeTruthy();
    expect(screen.queryByText('chart')).toBeNull();
  });
});
