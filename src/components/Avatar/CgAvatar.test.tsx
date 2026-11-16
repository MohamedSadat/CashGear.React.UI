import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CgAvatar } from './CgAvatar';
import { CgAvatarStack } from './CgAvatarStack';
import { avatarInitials } from './initials';

describe('avatarInitials', () => {
  it('takes the first letters of the first and last words', () => {
    expect(avatarInitials('Ada Lovelace')).toBe('AL');
    expect(avatarInitials('  grace  brewster murray hopper ')).toBe('GH');
    expect(avatarInitials('Linus')).toBe('L');
    expect(avatarInitials('')).toBe('');
  });

  it('takes one letter of an Arabic name, with its marks', () => {
    expect(avatarInitials('محمد سادات')).toBe('م');
    expect(avatarInitials('عُمر')).toBe('عُ');
  });
});

describe('CgAvatar', () => {
  it('is an image named by the person, with the name as its tooltip', () => {
    render(<CgAvatar name="ليلى حسن" color="#7c3aed" />);
    const avatar = screen.getByRole('img', { name: 'ليلى حسن' });
    expect(avatar).toHaveAttribute('title', 'ليلى حسن');
    expect(avatar).toHaveTextContent('ل');
    expect(avatar.style.getPropertyValue('--cg-avatar-background')).toBe('#7c3aed');
    expect(avatar.style.getPropertyValue('--cg-avatar-color')).toBe('#fff');
    expect(avatar).toHaveAttribute('data-size', 'small');
  });

  it('is hidden when decorative, and takes given initials, colours and size', () => {
    const { container } = render(<CgAvatar name="Ada Lovelace" initials="A" textColor="#111" size="large" decorative />);
    const avatar = container.querySelector('[data-cg-avatar]')!;
    expect(avatar).toHaveAttribute('aria-hidden', 'true');
    expect(avatar).not.toHaveAttribute('title');
    expect(avatar).toHaveTextContent('A');
    expect((avatar as HTMLElement).style.getPropertyValue('--cg-avatar-color')).toBe('#111');
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('draws a picture over the initials and drops it if it fails to load', () => {
    const { container } = render(<CgAvatar name="Ada Lovelace" src="/ada.png" />);
    const picture = container.querySelector('img')!;
    expect(picture).toHaveAttribute('alt', '');
    fireEvent.error(picture);
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByRole('img', { name: 'Ada Lovelace' })).toHaveTextContent('AL');
  });

  it('refuses an empty name unless decorative', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<CgAvatar name=" " />)).toThrow(/name/u);
    expect(() => render(<CgAvatar name="" decorative />)).not.toThrow();
  });
});

const people = ['ليلى', 'سامي', 'نور', 'هدى', 'رامي', 'جود'].map((name, index) => ({ key: `u${index}`, name, color: `var(--p${index})` }));

describe('CgAvatarStack', () => {
  it('shows up to max named avatars in a named group and counts the rest', () => {
    const overflowLabel = vi.fn((hidden: readonly { name: string }[]) => `و${hidden.length} آخرون: ${hidden.map((person) => person.name).join('، ')}`);
    render(<CgAvatarStack items={people} max={4} label="6 أشخاص في الصفحة" overflowLabel={overflowLabel} />);
    const group = screen.getByRole('group', { name: '6 أشخاص في الصفحة' });
    expect(group.querySelectorAll('[data-cg-avatar]')).toHaveLength(4);
    expect(screen.getByRole('img', { name: 'سامي' })).toBeInTheDocument();
    const more = screen.getByRole('img', { name: 'و2 آخرون: رامي، جود' });
    expect(more).toHaveTextContent('+2');
    expect(more).toHaveAttribute('title', 'و2 آخرون: رامي، جود');
    expect(overflowLabel).toHaveBeenCalledWith([people[4], people[5]]);
  });

  it('draws no "+N" when everyone fits, and nothing when empty', () => {
    const overflowLabel = vi.fn(() => 'x');
    const { container, rerender } = render(<CgAvatarStack items={people.slice(0, 3)} label="ثلاثة" overflowLabel={overflowLabel} />);
    expect(container.querySelector('[data-cg-avatar-overflow]')).toBeNull();
    expect(overflowLabel).not.toHaveBeenCalled();
    rerender(<CgAvatarStack items={[]} label="لا أحد" overflowLabel={overflowLabel} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('as an image, is one named image whose avatars are decoration', () => {
    render(<CgAvatarStack items={people} max={3} size="tiny" variant="image" label="مفتوحة لدى ليلى وسامي ونور وآخرين" overflowLabel={() => 'x'} />);
    const image = screen.getByRole('img', { name: 'مفتوحة لدى ليلى وسامي ونور وآخرين' });
    expect(image).toHaveAttribute('title', 'مفتوحة لدى ليلى وسامي ونور وآخرين');
    expect(screen.getAllByRole('img')).toHaveLength(1);
    expect(image.querySelectorAll('[aria-hidden="true"][data-cg-avatar]')).toHaveLength(3);
    expect(image.querySelector('[data-cg-avatar-overflow]')).toHaveAttribute('aria-hidden', 'true');
  });

  it('refuses an empty label and a max that is not a positive integer', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<CgAvatarStack items={people} label="" overflowLabel={() => 'x'} />)).toThrow(/label/u);
    expect(() => render(<CgAvatarStack items={people} label="x" max={0} overflowLabel={() => 'x'} />)).toThrow(RangeError);
  });
});
