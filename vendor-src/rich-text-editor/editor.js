import { Editor, Extension } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { TextStyleKit } from '@tiptap/extension-text-style';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import Image from '@tiptap/extension-image';
import { TableKit } from '@tiptap/extension-table';
import Placeholder from '@tiptap/extension-placeholder';
import DOMPurify from 'dompurify';

const tags = ['p','br','h1','h2','h3','strong','b','em','i','u','s','strike','span','mark',
  'ul','ol','li','a','img','hr','table','thead','tbody','tr','th','td','blockquote'];
const attrs = ['href','src','alt','title','style','colspan','rowspan','colwidth','start','dir','target','rel'];
const DocumentDirection = Extension.create({
  name: 'cashgearDirection',
  addGlobalAttributes() { return [{ types: ['paragraph','heading','blockquote','bulletList','orderedList','table'],
    attributes: { dir: { default: null, parseHTML: element => element.getAttribute('dir'),
      renderHTML: attributes => attributes.dir ? { dir: attributes.dir } : {} } } }]; }
});
export function safeUrl(value, image = false) {
  if (typeof value !== 'string' || !value.trim() || /[\u0000-\u0020\u007f\\]/.test(value)) return false;
  if (/^https:\/\//i.test(value)) { try { return !!new URL(value).hostname; } catch { return false; } }
  if (!image && /^(mailto:|tel:)[^\s]+$/i.test(value)) return true;
  return !value.startsWith('//') && !/^[a-z][a-z\d+.-]*:/i.test(value) && !value.startsWith('#');
}

// Detached parsing only. Never insert unsanitized HTML into the live document.
export function sanitize(html) {
  const fragment = DOMPurify.sanitize(html || '', { ALLOWED_TAGS: tags, ALLOWED_ATTR: attrs,
    ALLOW_DATA_ATTR: false, ALLOW_ARIA_ATTR: false, RETURN_DOM_FRAGMENT: true });
  for (const el of fragment.querySelectorAll('*')) {
    if (el.hasAttribute('href') && !safeUrl(el.getAttribute('href'))) el.removeAttribute('href');
    if (el.tagName === 'IMG' && !safeUrl(el.getAttribute('src'), true)) { el.remove(); continue; }
    const incoming = el.style;
    const clean = document.createElement('span').style;
    for (const key of ['color', 'background-color', 'font-family', 'font-size', 'text-align', 'line-height']) {
      const value = incoming.getPropertyValue(key);
      if (value && !/url|expression|var\(|[<>\\]/i.test(value) && value.length < 100)
        clean.setProperty(key, value);
    }
    el.removeAttribute('style');
    if (clean.cssText) el.setAttribute('style', clean.cssText);
    if (el.hasAttribute('dir') && !['rtl','ltr','auto'].includes(el.getAttribute('dir'))) el.removeAttribute('dir');
    if (el.tagName === 'A') { el.setAttribute('rel', 'noopener noreferrer'); el.removeAttribute('target'); }
  }
  const container = document.createElement('div');
  container.append(fragment);
  return container.innerHTML;
}

const commands = {
  undo: c => c.undo(), redo: c => c.redo(), bold: c => c.toggleBold(), italic: c => c.toggleItalic(),
  underline: c => c.toggleUnderline(), strike: c => c.toggleStrike(),
  bulletList: c => c.toggleBulletList(), orderedList: c => c.toggleOrderedList(),
  indent: c => c.sinkListItem('listItem'), outdent: c => c.liftListItem('listItem'),
  left: c => c.setTextAlign('left'), center: c => c.setTextAlign('center'),
  right: c => c.setTextAlign('right'), justify: c => c.setTextAlign('justify'),
  clear: c => c.unsetAllMarks().clearNodes().unsetTextAlign(),
  unlink: c => c.extendMarkRange('link').unsetLink(), rule: c => c.setHorizontalRule(),
  addRowBefore: c => c.addRowBefore(), addRowAfter: c => c.addRowAfter(), deleteRow: c => c.deleteRow(),
  addColumnBefore: c => c.addColumnBefore(), addColumnAfter: c => c.addColumnAfter(),
  deleteColumn: c => c.deleteColumn(), toggleHeaderRow: c => c.toggleHeaderRow(),
  mergeCells: c => c.mergeCells(), splitCell: c => c.splitCell(), deleteTable: c => c.deleteTable()
};

function toHex(color, fallback) {
  if (!color) return fallback;
  if (/^#[0-9a-f]{6}$/i.test(color)) return color;
  if (/^#[0-9a-f]{3}$/i.test(color)) return '#' + [...color.slice(1)].map(c => c + c).join('');
  const rgb = color.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  return rgb ? '#' + rgb.slice(1).map(c => Math.min(255, Number(c)).toString(16).padStart(2, '0')).join('') : fallback;
}

export function create(host, root, dotnet, initial) {
  let options = initial, disposed = false, sequence = 0, timer, frame, pending = null;
  let sending = null, acknowledged = '', lastState = '', composing = false;
  const html = () => {
    const document = editor.state.doc;
    const onlyChild = document.childCount === 1 ? document.firstChild : null;
    return onlyChild?.type.name === 'paragraph' && onlyChild.content.size === 0 ? '' : sanitize(editor.getHTML());
  };
  const editable = () => !options.disabled && !options.readOnly;
  const queueCommit = () => {
    clearTimeout(timer);
    if (disposed || composing || !editable()) return Promise.resolve();
    const value = html();
    if (value !== acknowledged || sending) pending = { html: value, generation: options.generation, sequence: ++sequence };
    if (!sending && pending) {
      sending = (async () => {
        while (pending && !disposed) {
          const update = pending; pending = null;
          try {
            await dotnet.invokeMethodAsync('ReceiveHtmlAsync', update.html, update.generation, update.sequence);
            if (update.generation === options.generation) acknowledged = update.html;
          } catch (error) {
            if (!disposed) root.dispatchEvent(new CustomEvent('cg-editor-error', { detail: error }));
            break;
          }
        }
      })().finally(() => { sending = null; });
    }
    return sending || Promise.resolve();
  };
  const changed = () => {
    if (disposed) return;
    scheduleState();
    if (composing || !editable()) return;
    if (options.bindValueMode === 'OnInput') void queueCommit();
    else if (options.bindValueMode === 'OnDelayedInput') {
      clearTimeout(timer); timer = setTimeout(queueCommit, options.inputDelay);
    }
  };
  function scheduleState() {
    if (frame || disposed) return;
    frame = requestAnimationFrame(() => {
      frame = null;
      const enabled = {}, active = {};
      for (const [key, command] of Object.entries(commands)) {
        enabled[key] = editable() && command(editor.can().chain()).run();
        active[key] = ['left','center','right','justify'].includes(key)
          ? editor.isActive({ textAlign: key }) : editor.isActive(key);
      }
      const text = editor.getText({ blockSeparator: '\n' });
      const state = { enabled, active, inTable: editor.isActive('table'),
        words: text.trim() ? text.trim().split(/\s+/u).length : 0,
        characters: Array.from(text).length,
        fontFamily: editor.getAttributes('textStyle').fontFamily || '',
        fontSize: editor.getAttributes('textStyle').fontSize || '',
        color: toHex(editor.getAttributes('textStyle').color, '#0f172a'),
        highlight: toHex(editor.getAttributes('highlight').color, '#fef08a'),
        heading: editor.getAttributes('heading').level?.toString() || '0' };
      const serialized = JSON.stringify(state);
      if (serialized !== lastState) {
        lastState = serialized;
        dotnet.invokeMethodAsync('ReceiveState', state).catch(() => {});
      }
    });
  }
  const editor = new Editor({
    element: host,
    extensions: [StarterKit.configure({ code: false, codeBlock: false, heading: { levels: [1,2,3] },
      link: { openOnClick: false, autolink: false, isAllowedUri: url => safeUrl(url) } }),
      DocumentDirection, TextStyleKit, TextAlign.configure({ types: ['heading','paragraph'] }),
      Highlight.configure({ multicolor: true }), Image.configure({ allowBase64: false }),
      TableKit.configure({ table: { resizable: false } }),
      Placeholder.configure({ placeholder: () => options.placeholder || '' })],
    content: sanitize(options.html), editable: editable(), injectCSS: false,
    editorProps: {
      transformPastedHTML: sanitize,
      handlePaste: (_, event) => !!event.clipboardData?.files.length,
      handleDrop: (_, event) => !!event.dataTransfer?.files.length,
      handleDOMEvents: {
        compositionstart: () => { composing = true; clearTimeout(timer); return false; },
        compositionend: () => { composing = false; queueMicrotask(changed); return false; }
      }
    },
    onUpdate: changed, onSelectionUpdate: scheduleState, onTransaction: scheduleState
  });
  acknowledged = html();
  function applyAttributes() {
    editor.setOptions({ editorProps: { ...editor.options.editorProps, attributes: {
      id: options.inputId, role: 'textbox', 'aria-multiline': 'true', 'aria-label': options.ariaLabel,
      'aria-describedby': options.ariaDescribedBy || '', 'aria-labelledby': options.ariaLabelledBy || '',
      'aria-invalid': options.ariaInvalid ? 'true' : 'false',
      'aria-readonly': options.readOnly ? 'true' : 'false', 'aria-disabled': options.disabled ? 'true' : 'false',
      tabindex: options.disabled ? '-1' : '0', dir: options.direction, spellcheck: 'true'
    } } });
  }
  applyAttributes(); scheduleState();
  const focusout = event => {
    if (!root.contains(event.relatedTarget)) void queueCommit();
  };
  root.addEventListener('focusout', focusout);
  return {
    setOptions(next) {
      if (disposed) return;
      const replace = next.generation !== options.generation;
      const modeChanged = next.bindValueMode !== options.bindValueMode || next.inputDelay !== options.inputDelay;
      const attributesChanged = ['inputId','ariaLabel','ariaLabelledBy','ariaDescribedBy','ariaInvalid','direction',
        'disabled','readOnly','placeholder'].some(key => next[key] !== options[key]);
      const editabilityChanged = next.disabled !== options.disabled || next.readOnly !== options.readOnly;
      options = next;
      if (replace) {
        clearTimeout(timer); pending = null;
        // Recreate the editor state to discard history across an external document replacement.
        editor.commands.setContent(sanitize(next.html), { emitUpdate: false });
        editor.view.updateState(editor.state.constructor.create({ schema: editor.schema,
          doc: editor.state.doc, plugins: editor.state.plugins }));
        acknowledged = html();
      }
      if (editabilityChanged) editor.setEditable(editable(), false);
      if (attributesChanged) applyAttributes();
      if (options.disabled || options.readOnly) { clearTimeout(timer); pending = null; }
      else if (modeChanged) { clearTimeout(timer); changed(); }
      scheduleState();
    },
    command(name, value) {
      if (disposed || !editable()) return false;
      let chain = editor.chain().focus();
      if (commands[name]) chain = commands[name](chain);
      else if (name === 'heading') chain = value === '0' ? chain.setParagraph() : chain.setHeading({ level: Number(value) });
      else if (name === 'fontFamily') chain = value ? chain.setFontFamily(value) : chain.unsetFontFamily();
      else if (name === 'fontSize') chain = value ? chain.setFontSize(value) : chain.unsetFontSize();
      else if (name === 'color') chain = chain.setColor(value);
      else if (name === 'highlight') chain = chain.setHighlight({ color: value });
      else if (name === 'link' && safeUrl(value.url)) chain = editor.state.selection.empty && !editor.isActive('link')
        ? chain.insertContent({ type: 'text', text: value.url, marks: [{ type: 'link', attrs: { href: value.url } }] }).unsetLink()
        : chain.extendMarkRange('link').setLink({ href: value.url });
      else if (name === 'image' && safeUrl(value.url, true)) chain = chain.setImage({ src: value.url, alt: value.alt || '' });
      else if (name === 'table') chain = chain.insertTable({ rows: Math.max(1, Math.min(20, value.rows)),
        cols: Math.max(1, Math.min(10, value.columns)), withHeaderRow: true });
      else return false;
      return chain.run();
    },
    getLink: () => editor.getAttributes('link').href || '',
    validateUrl: safeUrl,
    getHtml: html,
    flush: queueCommit,
    focus: () => { if (!disposed && !options.disabled) editor.commands.focus(); },
    dispose() {
      disposed = true; clearTimeout(timer); cancelAnimationFrame(frame); pending = null;
      root.removeEventListener('focusout', focusout); editor.destroy();
    }
  };
}
