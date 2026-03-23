/**
 * Legal page markdown content and converter.
 *
 * Content is read at build time via fs.readFileSync and exported as constants.
 * Next.js bundles these into the server JS so no runtime file reads are needed.
 */

import fs from 'fs';
import path from 'path';

function readMd(filename: string): string {
  return fs.readFileSync(path.join(process.cwd(), filename), 'utf-8');
}

/** Minimal markdown to HTML (no external deps) */
export function markdownToHtml(md: string): string {
  return md
    .replace(/^#### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/^---$/gm, '<hr />')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    .replace(/^(?!<[hlu]|<li|<hr|<strong|<table)(.+)$/gm, '<p>$1</p>')
    .replace(/<p>\s*<\/p>/g, '')
    .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');
}

export const TERMS_CONTENT = readMd('TERMS_OF_SERVICE.md');
export const PRIVACY_CONTENT = readMd('PRIVACY_POLICY.md');
export const COOKIE_CONTENT = readMd('COOKIE_POLICY.md');
