import { useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { StoryFrame, parityParameters } from '../../stories/storySupport';
import { CgButton } from '../Button';
import { CgRichTextEditor } from './CgRichTextEditor';
import type { CgRichTextEditorActions } from './CgRichTextEditor.types';

const source = 'CashGear.Blazor.UI/Components/Editors/RichTextEditor/* @ f8e7235b';
const difference = 'React composes immutable CgTabs/CgToolbar descriptors and native form association around the same checked-in Tiptap and DOMPurify engine.';
const meta: Meta = { title: 'Phase 23/RichTextEditor', component: CgRichTextEditor, parameters: parityParameters(source, difference) };
export default meta;
type Story = StoryObj;

const documentHtml = '<h2>Delivery instructions</h2><p>Leave cartons at the <strong>north receiving desk</strong>.</p><ul><li>Confirm the seal</li><li>Record the dock number</li></ul>';

function EditorFixture({ direction = 'ltr' }: { direction?: 'ltr' | 'rtl' }) {
  const [html, setHtml] = useState(direction === 'rtl' ? '<h2 dir="rtl">تعليمات التسليم</h2><p dir="rtl">اترك الشحنة عند مكتب الاستلام الرئيسي.</p>' : documentHtml);
  const actions = useRef<CgRichTextEditorActions>(null);
  const [saved, setSaved] = useState('');
  return <StoryFrame source={source} difference={difference} noteDirection={direction === 'rtl' ? 'ltr' : undefined}><div style={{ width: 'min(780px, calc(100vw - 40px))' }}>
    <CgRichTextEditor actionsRef={actions} value={html} onValueChange={setHtml} direction={direction} ariaLabel={direction === 'rtl' ? 'محرر التعليمات' : 'Delivery instructions'} height="300px" />
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}><CgButton appearance="outline" onClick={async () => {
      const editorActions = actions.current;
      if (!editorActions) {
        setSaved('Editor actions unavailable');
        return;
      }
      await editorActions.flush();
      setSaved(editorActions.getHtml());
    }}>Flush document</CgButton><output aria-label="Saved editor size">{saved ? `${saved.length} HTML characters` : 'Not flushed'}</output></div>
  </div></StoryFrame>;
}

function RequiredForm() {
  const [result, setResult] = useState('Not submitted');
  return <StoryFrame source={source} difference={difference}><form onSubmit={(event) => {
    event.preventDefault();
    const entry = new FormData(event.currentTarget).get('notes');
    setResult(typeof entry === 'string' ? entry : '');
  }} style={{ width: 720, maxWidth: 'calc(100vw - 40px)' }}><CgRichTextEditor name="notes" required defaultValue="" ariaLabel="Required notes" height="220px" /><CgButton type="submit" intent="primary">Submit notes</CgButton><output aria-label="Submitted rich text">{result}</output></form></StoryFrame>;
}

export const Primary: Story = { render: () => <EditorFixture /> };
export const RequiredFormIntegration: Story = { render: () => <RequiredForm /> };
export const ReadOnlyAndDisabled: Story = { render: () => <StoryFrame source={source} difference={difference}><div style={{ display: 'grid', gap: 16, width: 760 }}><CgRichTextEditor defaultValue={documentHtml} readOnly ariaLabel="Read-only notes" height="180px" /><CgRichTextEditor defaultValue={documentHtml} disabled ariaLabel="Disabled notes" height="180px" /></div></StoryFrame> };
export const Dark: Story = { globals: { theme: 'dark' }, render: () => <EditorFixture /> };
export const ArabicRtl: Story = { globals: { direction: 'rtl' }, render: () => <EditorFixture direction="rtl" /> };
export const Narrow: Story = { render: () => <div style={{ width: 340 }}><EditorFixture /></div> };
