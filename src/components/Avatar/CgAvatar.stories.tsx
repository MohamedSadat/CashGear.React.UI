import type { Meta, StoryObj } from '@storybook/react-vite';
import { StoryFrame, parityParameters } from '../../stories/storySupport';
import { CgAvatar } from './CgAvatar';
import { CgAvatarStack } from './CgAvatarStack';
import type { CgAvatarStackItem } from './CgAvatar.types';

const source = 'None: React only (Cash Gear Workspace Track U7, the presence avatars)';
const difference = 'The caller gives each person a colour; the avatar only draws it, and never picks one from the name.';
const meta = { title: 'Phase 37/Avatar', component: CgAvatar, parameters: parityParameters(source, difference) } satisfies Meta<typeof CgAvatar>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Eight presence colours that keep white initials at 4.5:1 or more. */
const PRESENCE = ['#1d4ed8', '#b42318', '#067647', '#7c3aed', '#9a3412', '#0e7490', '#be185d', '#4d5b70'];
const people: CgAvatarStackItem[] = ['ليلى حسن', 'سامي يوسف', 'نور الهدى', 'هدى علي', 'رامي خالد', 'جود سالم', 'Ada Lovelace']
  .map((name, index) => ({ key: `u${index}`, name, color: PRESENCE[index % PRESENCE.length]! }));
const more = (hidden: readonly CgAvatarStackItem[]) => `و${hidden.length} آخرون: ${hidden.map((person) => person.name).join('، ')}`;

function Gallery() {
  return <StoryFrame source={source} difference={difference}>
    <div style={{ display: 'grid', gap: 16 }} data-testid="avatar-gallery">
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        {(['tiny', 'small', 'medium', 'large'] as const).map((size, index) => <CgAvatar key={size} size={size} name={people[index]!.name} color={people[index]!.color} />)}
        <CgAvatar size="medium" name="Ada Lovelace" color={PRESENCE[3]} />
        <CgAvatar size="medium" name="ضيف" />
      </div>
      <CgAvatarStack items={people} max={4} size="medium" label={`${people.length} أشخاص في هذه الصفحة`} overflowLabel={more} />
      <CgAvatarStack items={people.slice(0, 3)} size="small" label="ثلاثة أشخاص في هذه الصفحة" overflowLabel={more} />
      <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
        <span>الميزانية</span>
        <CgAvatarStack items={people.slice(0, 5)} max={3} size="tiny" variant="image" label="مفتوحة لدى ليلى حسن وسامي يوسف ونور الهدى و2 آخرين" overflowLabel={more} />
      </span>
    </div>
  </StoryFrame>;
}

export const SizesAndStacks: Story = { args: { name: 'ليلى حسن' }, render: () => <Gallery />, globals: { direction: 'rtl' } };
export const Dark: Story = { args: { name: 'ليلى حسن' }, render: () => <Gallery />, globals: { theme: 'dark', direction: 'rtl' } };
export const LeftToRight: Story = { args: { name: 'ليلى حسن' }, render: () => <Gallery /> };
