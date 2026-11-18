import type { Meta, StoryObj } from '@storybook/react-vite';
import { CgChart } from '../components/Chart';
import { StoryFrame, parityParameters } from './storySupport';

const source = 'CashGear.Blazor.UI/Components/Data/Chart: CgChartAxisLayout.cs, CgChartLayoutEngine.cs (FitPointLabels, FitOutsideLabels), README "Differences from CashGear.React.UI"';
const difference = 'Text widths stay estimated in card charts, as in Blazor; document charts measure with the host measurer when given one.';
const meta: Meta = { title: 'Blazor parity 2026-11/Chart layout', component: CgChart, parameters: parityParameters(source, difference) };
export default meta;
type Story = StoryObj;

interface Sale { customer: string; amount: number }
const customers: ReadonlyArray<Sale> = [
  { customer: 'Northern regional distribution warehouse and logistics hub', amount: 18_400_000 },
  ...Array.from({ length: 34 }, (_, index) => ({ customer: `Customer ${String(index + 1).padStart(2, '0')}`, amount: 1_200_000 + ((index * 7_919) % 41) * 260_000 })),
];

export const HorizontalBarsManyCategories: Story = {
  render: () => <StoryFrame source={source} difference={difference}>
    <div style={{ inlineSize: 'min(44rem, 100%)', blockSize: 420 }}>
      <CgChart data={customers} orientation="horizontal" title="Sales by customer" height={420}
        series={[{ type: 'bar', name: 'Sales', argument: (row) => row.customer, value: (row) => row.amount }]} />
    </div>
  </StoryFrame>,
};

const regions: ReadonlyArray<Sale> = [
  { customer: 'Cairo', amount: 940 }, { customer: 'Giza', amount: 610 }, { customer: 'Alexandria', amount: 1_180 }, { customer: 'Suez', amount: 320 },
];

export const OutsideBarLabelsStayOnThePlot: Story = {
  render: () => <StoryFrame source={source} difference={difference}>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(20rem, 1fr))', gap: 16 }}>
      <CgChart data={regions} height={300} pointLabels={{ visible: true }} series={[{ type: 'bar', name: 'Orders', argument: (row) => row.customer, value: (row) => row.amount }]} />
      <CgChart data={regions} height={300} orientation="horizontal" pointLabels={{ visible: true }} series={[{ type: 'bar', name: 'Orders', argument: (row) => row.customer, value: (row) => row.amount }]} />
    </div>
  </StoryFrame>,
};

const channels: ReadonlyArray<Sale> = [
  { customer: 'Wholesale partners', amount: 45 }, { customer: 'Retail showrooms', amount: 30 }, { customer: 'Online channel sales', amount: 25 },
];

export const DocumentPieFitsLongLabels: Story = {
  render: () => <StoryFrame source={source} difference={difference}>
    <CgChart data={channels} height={300} appearance={{ chartArea: { padding: 8 } }}
      series={[{ type: 'pie', name: 'Mix', argument: (row) => row.customer, value: (row) => row.amount, showPointLabels: true, pointLabelPosition: 'outsideEnd', pointLabelContent: ['argument', 'percentage'] }]} />
  </StoryFrame>,
};
