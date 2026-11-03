import React from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { expect, within } from 'storybook/test';
import AnalysisToolSections from './AnalysisToolSections';
import config from '../../../config/gen3/analysisTools.json';

const meta = {
  component: AnalysisToolSections,
  title: 'components/analysis/AnalysisToolSections',
  decorators: [(Story) => <div style={{ width: 1400 }}><Story /></div>],
} satisfies Meta<typeof AnalysisToolSections>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    sections: config.sections.map((section) => ({
      ...section,
      tools: section.tools.map((tool) => ({ ...tool, href: '/' })),
    })),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Exercise the actual upstream cards, including Mantine's injected style
    // elements between columns, which a simplified local fixture would miss.
    for (const title of ['Projects', 'Cohort Builder', 'Repository', 'Chat']) {
      const card = (await canvas.findByAltText(`${title} logo`)).closest('.mantine-Grid-inner');
      expect(card).not.toBeNull();
      const columns = card!.querySelectorAll('.mantine-Grid-col');
      expect(getComputedStyle(columns[0]).paddingTop).toBe('8px');
      expect(getComputedStyle(columns[1]).paddingTop).toBe('8px');
      expect(getComputedStyle(columns[1]).paddingBottom).toBe('8px');
      expect(getComputedStyle(columns[2]).paddingTop).toBe('0px');
      expect(getComputedStyle(card!).columnGap).toBe('0px');
      expect(card!.getBoundingClientRect().height).toBeGreaterThan(95);
    }
  },
};
