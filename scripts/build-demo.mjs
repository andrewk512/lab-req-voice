// Builds the GitHub Pages demo: the OSCAR eForm made standalone, filled with a fictional patient.
// Usage: node scripts/build-demo.mjs [outDir]   (default: _site)
//
// The eForm expects to run inside OSCAR: its voice loader only starts on efmformadd_data.jsp and
// fetches its files through ../eform/displayImage.do. Here the page is static, so those two hooks
// are pointed at files sitting next to the page. Nothing else in the voice code is changed.
import { readFileSync, writeFileSync, copyFileSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(root, process.argv[2] || '_site');

const ASSETS = [
  'LabReq20212/kai_lab_req_2019_05_31.png',
  'lab-req-voice-config.js',
  'lab-req-voice-index.js',
  'needle.wasm.js',
  'whistle.cact.js',
  'needle3.cact.js',
];

// Fictional patient and provider. Numbers are deliberately not valid identifiers.
const DEMO_VALUES = {
  doctor: 'Dr. Demo Physician',
  doctor_ohip_no: '000000',
  doctor_cpsid: '00000',
  clinic_phone: '(555) 010-0000',
  hin: '0000 000 000',
  hinversion: 'ZZ',
  dobc2: '1980 01 01',
  province: 'ON',
  phone: '(555) 010-0199',
  patient_nameL: 'SAMPLE',
  patient_nameF: 'Jane',
  patient_nameM: 'Q',
  current_user_fname_lname: 'Demo Physician',
  PatientGender: 'F',
};
const DEMO_TEXTAREAS = {
  doctor_address: 'Example Family Health Team\n100 Demo Street\nToronto ON  A1A 1A1',
  address: '1 Sample Avenue\nToronto ON  A1A 1A1',
};

const BANNER = `
<div class="DoNotPrint" id="demo-banner" style="font:14px/1.45 system-ui,sans-serif;max-width:734px;margin:0 0 12px;padding:10px 14px;border:1px solid #b9d3dc;border-radius:6px;background:#eef6f8;color:#16343d">
  <strong>Lab Req Voice demo.</strong> The patient is fictional and nothing is submitted anywhere.
  Click <em>Dictate labs</em> (top right), allow the microphone, say the tests you want
  (for example <em>"CBC, electrolytes, A1C and a lipid panel"</em>), then click again.
  Speech recognition runs entirely in this browser; the first use downloads about 57&nbsp;MB of models.
  Ticking a box by hand also shows the companion auto-fill (try <em>Sodium</em> or <em>Chlamydia</em>).
  <a href="https://github.com/andrewk512/lab-req-voice">Source on GitHub</a>.
</div>`;

function replaceOnce(html, from, to, what) {
  const count = html.split(from).length - 1;
  if (count !== 1) throw new Error(`${what}: expected 1 match, found ${count}`);
  return html.replace(from, () => to);
}

function replaceAll(html, from, to, expected, what) {
  const count = html.split(from).length - 1;
  if (count !== expected) throw new Error(`${what}: expected ${expected} matches, found ${count}`);
  return html.split(from).join(to);
}

let html = readFileSync(join(root, 'LabReq20212/LabReq20212.html'), 'utf8');

// OSCAR-only scripts (print/fax/signature controls, calendar widget) do not exist outside OSCAR.
html = html.replace(/<script[^>]*src="\$\{oscar_javascript_path\}[^"]*"[^>]*><\/script>\s*/g, '');
html = html.replace(/<script[^>]*src="\.\.\/share\/calendar\/[^"]*"[^>]*><\/script>\s*/g, '');
html = html.replace(/<link[^>]*href="\.\.\/share\/calendar\/[^"]*"[^>]*\/?>\s*/g, '');
html = replaceOnce(html, 'Calendar.setup(', 'window.Calendar && Calendar.setup(', 'calendar setup');

// No provider signature image in the demo.
html = replaceOnce(html, 'src="${oscar_image_path}BNK.png"', 'src="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=="', 'signature image');
html = replaceOnce(html, 'onload="checkGender();SignForm();"', 'onload="checkGender();"', 'body onload');
html = replaceAll(html, '${oscar_image_path}', '', 1, 'background image path');

// The voice loader: start on this page, load files from next to it.
html = replaceOnce(html, '/\\/eform\\/efmformadd_data\\.jsp$/.test(e.pathname)', '!0', 'voice page gate');
// (the third match is the unused OSCAR signature loader)
html = replaceAll(html, '../eform/displayImage.do?imagefile=', './', 3, 'voice file URLs');

// Static page: never post the form.
html = replaceOnce(html, '<form method="post" action="" name="FormName" id="FormName" >',
  '<form method="post" action="" name="FormName" id="FormName" onsubmit="return false;">', 'form tag');
html = html.replace(/(<input value="(?:Submit|Print & Submit)"[^>]*?)>/g, '$1 style="display:none">');

// Demo data, written into the markup so the auto-fill treats it like a saved form.
for (const [id, value] of Object.entries(DEMO_VALUES)) {
  const re = new RegExp(`(<input[^>]*\\bid="${id}"[^>]*?)(\\s*/?>)`);
  if (!re.test(html)) throw new Error(`demo field not found: ${id}`);
  html = html.replace(re, (_, tag, end) => `${tag} value="${value}"${end}`);
}
for (const [id, value] of Object.entries(DEMO_TEXTAREAS)) {
  const re = new RegExp(`(<textarea[^>]*\\bid="${id}"[^>]*>)(</textarea>)`);
  if (!re.test(html)) throw new Error(`demo textarea not found: ${id}`);
  html = html.replace(re, (_, open, close) => open + value + close);
}
html = replaceOnce(html, 'id="today" type="text" class=" noborder"',
  'id="today" type="text" class=" noborder" value="' + new Date().toISOString().slice(0, 10) + '"', 'today field');

html = replaceOnce(html, '<title>Ontario Lab Requisition</title>',
  '<title>Lab Req Voice demo</title>\n<meta name="viewport" content="width=800">', 'title');
html = replaceOnce(html, '<form method="post"', BANNER + '\n<form method="post"', 'banner');

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'index.html'), html);
writeFileSync(join(out, '.nojekyll'), '');
for (const asset of ASSETS) copyFileSync(join(root, asset), join(out, asset.split('/').pop()));
console.log(`demo written to ${out}`);
