import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = process.cwd();
const accountExportPath = path.join(root, 'lib/accountExport.ts');
const brandPath = path.join(root, 'public/ficonter-mark.svg');
const iconPath = path.join(root, 'public/icon.svg');
const swPath = path.join(root, 'public/sw.js');

const accountExport = fs.readFileSync(accountExportPath, 'utf8');
const brand = fs.readFileSync(brandPath);
const icon = fs.readFileSync(iconPath);
const sw = fs.readFileSync(swPath, 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
  console.log(`✓ ${message}`);
}

const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');

assert(accountExport.includes('CURRENT_BRAND_MARK_SRC = "/ficonter-mark.svg"'), 'PDF exports reference the current FICONTER emblem asset.');
assert(accountExport.includes('context.drawImage(this.brandMark'), 'PDF page headers render the current emblem image.');
assert(accountExport.includes('CURRENT_BRAND_WORDMARK = "FICONTER"'), 'PDF exports use the current FICONTER wordmark.');
assert(accountExport.includes('CURRENT_BRAND_DESCRIPTOR = "FINANCIAL CONTROL CENTER"'), 'PDF exports use the current brand descriptor.');
assert(!accountExport.includes('context.fillText("F", MARGIN + 23, 56)'), 'Legacy synthetic circle-F PDF emblem has been removed.');
assert(hash(brand) === hash(icon), 'Primary current emblem assets are synchronized.');
assert(sw.includes('ficonter-pwa-static-v7-runtime-recovery'), 'PWA static cache is versioned so stale brand assets are replaced.');

console.log('Export branding V1.26 verification passed.');
