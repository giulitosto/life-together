// ── Shared section titles, field renderers, and PDF export ──────────────────
// Used by index.html (single-section download) and my-reflections.html
// (combined download). Order of keys here is the canonical module order.

const PAGE_TITLES = {
  'module-1': 'Where I Am — Wheel of Life',
  'module-1-2': 'Who I Am — Origin Story & Values',
  'module-1-3': 'How I Am — Lights & Shadows',
  'module-1-4': 'I Am Enough — Self-Love & Love Languages',
  'module-1-5': 'Why I Am — Life Purpose',
  'module-2-1': 'Land Work',
  'module-2-2': 'Seeing Each Other',
  'module-2-3': 'Intentions & Words',
  'module-2-4': 'Love Languages Together',
  'module-2-5': 'Conversation Cards',
  'module-3-1': '1 + 1 = 3',
  'module-3-2': 'Our Wheel',
  'module-3-3': 'Relationship Alliance',
  'module-3-4': 'Co-living',
  'module-3-5': 'Co-Dreaming'
};

function humanizeFieldId(id) {
  return id.replace(/^r-/, '').replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

const STATE_FIELD_RENDERERS = {
  'values-state': (val, blocks) => {
    const v = JSON.parse(val);
    const top5 = (v.allValues || []).filter(x => v.valueState && v.valueState[x] === 2);
    blocks.push(['Top 5 Values', top5.map(x => `${x}: ${(v.top5Reflections || {})[x] || ''}`).join('\n') || '(none)']);
  },
  'chapters-state': (val, blocks) => {
    JSON.parse(val).forEach((c, i) => blocks.push([c.title || `Chapter ${i + 1}`, c.reflection || '']));
  },
  'ls-state': (val, blocks) => {
    const ls = JSON.parse(val);
    blocks.push(['Lights', (ls.lights || []).filter(Boolean).join(', ') || '(none)']);
    blocks.push(['Shadows', (ls.shadows || []).filter(Boolean).join(', ') || '(none)']);
  },
  'land-state': (val, blocks) => {
    const l = JSON.parse(val);
    blocks.push(['My Land', (l.my || []).filter(Boolean).join('\n') || '(none)']);
    blocks.push(['Your Land', (l.your || []).filter(Boolean).join('\n') || '(none)']);
    blocks.push(['Shared Land', (l.shared || []).filter(Boolean).join('\n') || '(none)']);
  },
  'tags-state': (val, blocks) => {
    const t = JSON.parse(val);
    ['a', 'b'].forEach(p => {
      blocks.push([`Person ${p.toUpperCase()} — Lights`, ((t[p] || {}).light || []).join(', ') || '(none)']);
      blocks.push([`Person ${p.toUpperCase()} — Shadows`, ((t[p] || {}).shadow || []).join(', ') || '(none)']);
    });
  },
  'intentions-state': (val, blocks) => {
    const s = JSON.parse(val);
    blocks.push(['Intentions', (s.intentions || []).filter(Boolean).join('\n') || '(none)']);
    blocks.push(['Word swaps', (s.wordPairs || []).map(p => `${p.less} → ${p.more}`).join('\n') || '(none)']);
  },
  'wheel-state': (val, blocks) => {
    const w = JSON.parse(val);
    if (w.scores) {
      blocks.push(['Individual A scores', (w.scores[0] || []).join(', ')]);
      blocks.push(['Individual B scores', (w.scores[1] || []).join(', ')]);
    }
    if (w.relScores) blocks.push(['Relationship wheel scores', w.relScores.join(', ')]);
  },
  'notes-state': (val, blocks) => {
    const n = JSON.parse(val);
    (n.notes || []).forEach((col, i) => {
      blocks.push([`Alliance column ${i + 1}`, col.map(note => note.text).join('\n') || '(none)']);
    });
  },
  'practices-state': (val, blocks) => {
    const p = JSON.parse(val);
    const chosen = (p.practices || []).filter(x => p.practiceState && p.practiceState[x]);
    blocks.push(['Daily practices chosen', chosen.join('\n') || '(none)']);
  },
  'adventures-state': (val, blocks) => {
    const list = JSON.parse(val);
    blocks.push(['Adventure list', list.map(a => (a.done ? '✓ ' : '• ') + a.text).join('\n') || '(none)']);
  },
  'card-state': () => {}
};

function renderSectionBlocks(savedData) {
  const blocks = [];
  Object.entries(savedData || {}).forEach(([id, val]) => {
    if (STATE_FIELD_RENDERERS[id]) {
      STATE_FIELD_RENDERERS[id](val, blocks);
    } else if (val) {
      blocks.push([humanizeFieldId(id), val]);
    }
  });
  return blocks;
}

// sections: [{ page, blocks }] — one addPage() between each, blocks rendered in order
function buildReflectionsPdf(sections) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  sections.forEach(({ page, blocks }, i) => {
    if (i > 0) doc.addPage();
    doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(44, 74, 90);
    doc.text(`Relation-ship — ${PAGE_TITLES[page] || page}`, 105, 18, { align: 'center' });
    doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(150, 150, 150);
    doc.text(`Generated ${new Date().toLocaleDateString()}`, 105, 25, { align: 'center' });
    let y = 35;
    blocks.forEach(([title, body]) => {
      if (y > 260) { doc.addPage(); y = 20; }
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(44, 74, 90);
      doc.text(title, 20, y); y += 6;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(50, 50, 50);
      const lines = doc.splitTextToSize(body || '(no notes)', 170);
      doc.text(lines, 20, y); y += lines.length * 5 + 8;
    });
  });
  return doc;
}
