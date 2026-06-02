'use client';

import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { Bold, Image as ImageIcon, Italic, Link as LinkIcon, List, Underline } from 'lucide-react';
import { htmlToPlainCampaignText } from '@/lib/campaigns/campaignMergeTags';
import { CampaignMergeTagBar } from './CampaignMergeTagBar';
import styles from './campaigns.module.scss';

function insertHtmlAtCursor(html: string) {
  document.execCommand('insertHTML', false, html);
}

export function CampaignRichTextEditor({
  initialHtml,
  disabled = false,
  onChange,
}: {
  /** Applied once on mount; parent should change `key` to load new content (e.g. template switch). */
  initialHtml: string;
  disabled?: boolean;
  onChange: (html: string, plainText: string) => void;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const htmlInputRef = useRef<HTMLInputElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);
  const [html, setHtml] = useState(initialHtml);

  useLayoutEffect(() => {
    if (!editorRef.current) return;
    editorRef.current.innerHTML = initialHtml;
    setHtml(initialHtml);
    if (htmlInputRef.current) htmlInputRef.current.value = initialHtml;
    if (textInputRef.current) textInputRef.current.value = htmlToPlainCampaignText(initialHtml);
    // Mount-only: parent remounts this editor (via `key`) when template defaults change.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional mount-only init
  }, []);

  const syncFromEditor = useCallback(() => {
    const nextHtml = editorRef.current?.innerHTML ?? '';
    const nextText = htmlToPlainCampaignText(nextHtml);
    setHtml(nextHtml);
    if (htmlInputRef.current) htmlInputRef.current.value = nextHtml;
    if (textInputRef.current) textInputRef.current.value = nextText;
    onChange(nextHtml, nextText);
  }, [onChange]);

  const runCommand = (command: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    syncFromEditor();
  };

  const insertLink = () => {
    const url = window.prompt('Link URL (https://…)');
    if (!url?.trim()) return;
    runCommand('createLink', url.trim());
  };

  const insertImage = () => {
    const url = window.prompt('Image URL (https://…)');
    if (!url?.trim()) return;
    insertHtmlAtCursor(
      `<img src="${url.trim().replace(/"/g, '&quot;')}" alt="" style="max-width:100%;height:auto;border-radius:8px;" />`,
    );
    syncFromEditor();
  };

  const insertToken = (token: string) => {
    editorRef.current?.focus();
    document.execCommand('insertText', false, token);
    syncFromEditor();
  };

  return (
    <div className={styles.richEditor}>
      {!disabled ? (
        <div className={styles.richToolbar} role="toolbar" aria-label="Formatting">
          <button
            type="button"
            className={styles.richToolButton}
            onClick={() => runCommand('bold')}
          >
            <Bold size={16} aria-hidden />
            <span className={styles.srOnly}>Bold</span>
          </button>
          <button
            type="button"
            className={styles.richToolButton}
            onClick={() => runCommand('italic')}
          >
            <Italic size={16} aria-hidden />
            <span className={styles.srOnly}>Italic</span>
          </button>
          <button
            type="button"
            className={styles.richToolButton}
            onClick={() => runCommand('underline')}
          >
            <Underline size={16} aria-hidden />
            <span className={styles.srOnly}>Underline</span>
          </button>
          <button type="button" className={styles.richToolButton} onClick={insertLink}>
            <LinkIcon size={16} aria-hidden />
            <span className={styles.srOnly}>Link</span>
          </button>
          <button
            type="button"
            className={styles.richToolButton}
            onClick={() => runCommand('insertUnorderedList')}
          >
            <List size={16} aria-hidden />
            <span className={styles.srOnly}>Bullet list</span>
          </button>
          <button type="button" className={styles.richToolButton} onClick={insertImage}>
            <ImageIcon size={16} aria-hidden />
            <span className={styles.srOnly}>Image</span>
          </button>
        </div>
      ) : null}

      <CampaignMergeTagBar onInsert={insertToken} disabled={disabled} />

      <div
        ref={editorRef}
        className={styles.richEditorSurface}
        contentEditable={!disabled}
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label="Email message"
        onInput={syncFromEditor}
        onBlur={syncFromEditor}
      />

      <input ref={htmlInputRef} type="hidden" name="body_html" defaultValue={html} readOnly />
      <input
        ref={textInputRef}
        type="hidden"
        name="body_text"
        defaultValue={htmlToPlainCampaignText(html)}
        readOnly
      />
    </div>
  );
}
