/**
 * BPscript Timeline — Canvas 2D interactive visualization
 *
 * Renders timed tokens as colored blocks on a zoomable, scrollable timeline.
 * Voices are stacked vertically. CV and control lanes appear below their voice.
 * Features: zoom (Ctrl+wheel), scroll (wheel/drag), auto-follow cursor,
 * block selection, hover tooltips, edge handles for future drag, minimap.
 */

// ============ Color palette ============

const VOICE_COLORS = [
  '#e94560', '#4a90d9', '#50c878', '#e9a845', '#c77dba',
  '#45b7d1', '#f06292', '#aed581', '#ffb74d', '#90a4ae',
];

const COLORS = {
  bg: '#0a0f1a',
  trackBg: '#0d1b2a',
  trackBorder: '#0f3460',
  text: '#ccc',
  textDim: '#666',
  ruler: '#1a2740',
  rulerText: '#555',
  rulerLine: '#333',
  cursor: '#00ff88',
  cursorGlow: 'rgba(0, 255, 136, 0.15)',
  selection: 'rgba(233, 69, 96, 0.3)',
  selectionBorder: '#e94560',
  gap: 'rgba(255,255,255,0.03)',
  silence: 'rgba(255,255,255,0.06)',
  controlMark: '#4a90d9',
  cvMark: '#e9a845',
  headerBg: '#0d1b2a',
  headerBorder: '#0f3460',
  edgeHandle: '#fff',
  minimap: 'rgba(233, 69, 96, 0.4)',
  minimapView: 'rgba(0, 255, 136, 0.25)',
  minimapBg: '#0a0f1a',
};

// ============ TimelineRange — time↔pixel conversion ============

class TimelineRange {
  constructor(totalMs) {
    this.totalMs = totalMs;
    this.scrollX = 0;
    this.zoom = 1;           // pixels per ms
    this._viewWidth = 800;
  }

  setViewWidth(w) { this._viewWidth = w; }
  get viewWidth() { return this._viewWidth; }
  get visibleMs() { return this._viewWidth / this.zoom; }
  get scrollMs() { return this.scrollX / this.zoom; }

  msToX(ms) { return (ms * this.zoom) - this.scrollX; }
  xToMs(x) { return (x + this.scrollX) / this.zoom; }

  zoomAt(x, factor) {
    const ms = this.xToMs(x);
    this.zoom = Math.max(0.005, Math.min(20, this.zoom * factor));
    this.scrollX = (ms * this.zoom) - x;
    this.clampScroll();
  }

  fitToView() {
    this.zoom = this._viewWidth / Math.max(1, this.totalMs);
    this.scrollX = 0;
  }

  clampScroll() {
    const maxScroll = Math.max(0, this.totalMs * this.zoom - this._viewWidth);
    this.scrollX = Math.max(0, Math.min(maxScroll, this.scrollX));
  }

  /** Ensure a ms position is visible, scrolling if needed */
  ensureVisible(ms) {
    const x = this.msToX(ms);
    const margin = this._viewWidth * 0.15;
    if (x > this._viewWidth - margin) {
      this.scrollX = (ms * this.zoom) - this._viewWidth + margin;
      this.clampScroll();
    } else if (x < margin) {
      this.scrollX = (ms * this.zoom) - margin;
      this.clampScroll();
    }
  }
}

// ============ Layout constants ============

const HEADER_W = 80;
const TRACK_H = 28;
const CTRL_H = 16;
const CV_H = 20;
const RULER_H = 22;
const MINIMAP_H = 18;
const VOICE_GAP = 4;
const BLOCK_RADIUS = 3;
const EDGE_HANDLE_W = 4; // edge handle hit zone width (px)

// ============ Timeline class ============

export class Timeline {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {Object} options
   * @param {Function} [options.onSelect] - callback(note, voiceIndex, blockIndex)
   * @param {Function} [options.onSeek] - callback(ms)
   * @param {Function} [options.onResize] - callback(voiceIdx, blockIdx, newStart, newEnd) — block edge drag
   */
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.range = new TimelineRange(1000);
    this.onSelect = options.onSelect || null;
    this.onSeek = options.onSeek || null;
    this.onResize = options.onResize || null;

    // Data
    this.voices = [];
    this.silences = [];     // [{start, end}] — explicit silence/rest gaps
    this.polyGroups = [];   // [{start, end, voiceCount}] — polymetric groups from { , }
    this._controlTable = null; // CT0 → [{key, value}]
    this.totalMs = 0;

    // State
    this._cursorMs = -1;
    this._selectedBlock = null;
    this._hoveredBlock = null;
    this._hoveredEdge = null;  // { voiceIdx, blockIdx, side: 'left'|'right' }
    this._isDragging = false;
    this._dragStartX = 0;
    this._dragStartScroll = 0;
    this._isResizing = false;  // edge drag in progress
    this._resizeEdge = null;   // { voiceIdx, blockIdx, side }
    this._resizeOrigMs = 0;    // original ms value of the edge being dragged
    this._autoFollow = true;
    this._animFrame = 0;

    // DPI
    this._dpr = window.devicePixelRatio || 1;

    this._bindEvents();
  }

  // ============ Data loading ============

  load(tokens, { cvTable = null, controlTable = null } = {}) {
    if (!tokens || tokens.length === 0) {
      this.voices = [];
      this.silences = [];
      this.totalMs = 0;
      this.render();
      return;
    }

    const cvNames = new Set();
    if (cvTable) for (const cv of cvTable) cvNames.add(cv.name);

    const notes = [];
    const controls = [];
    const cvTokens = [];
    const silences = [];
    const polyGroups = []; // [{start, end, voiceCount}] from structural markers

    // Parse structural markers { , } to detect polymetric groups
    let polyStack = []; // stack of {startMs, voiceIdx (count of , seen)}
    for (let ti = 0; ti < tokens.length; ti++) {
      const t = tokens[ti];
      if (t.token === '{') {
        polyStack.push({ start: t.start, voices: 1 });
      } else if (t.token === ',' && polyStack.length > 0) {
        polyStack[polyStack.length - 1].voices++;
      } else if (t.token === '}' && polyStack.length > 0) {
        const group = polyStack.pop();
        polyGroups.push({ start: group.start, end: t.end, voiceCount: group.voices });
      } else if (t.token.startsWith('_') && t.token !== '_') {
        t._srcIdx = ti;
        controls.push(t);
      } else if (cvNames.has(t.token)) {
        cvTokens.push(t);
      } else if (t.token === '-' && t.end > t.start) {
        silences.push(t);
      } else if (t.token !== '_' && t.token !== '-' && t.end > t.start
                 && t.token !== '{' && t.token !== '}' && t.token !== ',') {
        t._srcIdx = ti; // index in original tokens array for writeback
        notes.push(t);
      }
    }

    this.totalMs = Math.max(...tokens.map(t => t.end), 1);
    this.range.totalMs = this.totalMs;
    this.silences = silences;
    this.polyGroups = polyGroups;
    this._controlTable = controlTable;

    // Group notes into non-overlapping voices
    const voiceNotes = [];
    for (const n of notes) {
      let placed = false;
      for (const v of voiceNotes) {
        const last = v[v.length - 1];
        if (n.start >= last.end - 1) {
          v.push(n);
          placed = true;
          break;
        }
      }
      if (!placed) voiceNotes.push([n]);
    }

    // Assign controls to voices using stream order:
    // each control belongs to the voice containing the next note in the original token stream.
    // Build a map: srcIdx → voiceIdx for each note
    const voiceControls = voiceNotes.map(() => []);
    const noteToVoice = new Map();
    for (let vi = 0; vi < voiceNotes.length; vi++) {
      for (const n of voiceNotes[vi]) {
        if (n._srcIdx != null) noteToVoice.set(n._srcIdx, vi);
      }
    }
    // For each control, find the next note after it in the stream
    for (const ctrl of controls) {
      if (ctrl._srcIdx == null) {
        // No index — fall back to first voice
        voiceControls[0].push(ctrl);
        continue;
      }
      let targetVoice = 0;
      // Scan forward from control's position to find the next note
      for (let si = ctrl._srcIdx + 1; si < tokens.length && si < ctrl._srcIdx + 20; si++) {
        if (noteToVoice.has(si)) {
          targetVoice = noteToVoice.get(si);
          break;
        }
      }
      voiceControls[targetVoice].push(ctrl);
    }

    // Assign CV tokens to closest voice
    const cvByVoice = voiceNotes.map(() => []);
    for (const cvt of cvTokens) {
      let bestVoice = 0, bestDist = Infinity;
      for (let vi = 0; vi < voiceNotes.length; vi++) {
        for (const n of voiceNotes[vi]) {
          const dist = Math.abs(n.start - cvt.start);
          if (dist < bestDist) { bestDist = dist; bestVoice = vi; }
        }
      }
      cvByVoice[bestVoice].push(cvt);
    }

    this.voices = voiceNotes.map((notes, i) => ({
      label: `voice ${i + 1}`,
      notes,
      controls: voiceControls[i],
      cv: cvByVoice[i],
      color: VOICE_COLORS[i % VOICE_COLORS.length],
    }));

    this._selectedBlock = null;
    this._hoveredBlock = null;
    this._hoveredEdge = null;
    this.resize();
    this.range.fitToView();
    this.render();
  }

  // ============ Sizing ============

  resize() {
    const parent = this.canvas.parentElement;
    const rect = parent?.getBoundingClientRect() || { width: 800, height: 300 };
    // Account for parent padding (clientWidth excludes scrollbar, padding is subtracted)
    const style = parent ? getComputedStyle(parent) : {};
    const padL = parseFloat(style.paddingLeft) || 0;
    const padR = parseFloat(style.paddingRight) || 0;
    const w = Math.floor((parent?.clientWidth || rect.width) - padL - padR);
    const h = Math.max(80, this._calcHeight());
    this._dpr = window.devicePixelRatio || 1;
    this.canvas.width = w * this._dpr;
    this.canvas.height = h * this._dpr;
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.ctx.setTransform(this._dpr, 0, 0, this._dpr, 0, 0);
    this.range.setViewWidth(w - HEADER_W);
  }

  _calcHeight() {
    let h = RULER_H + MINIMAP_H;
    for (const v of this.voices) {
      h += TRACK_H + VOICE_GAP;
      if (v.controls.length > 0) h += CTRL_H;
      if (v.cv.length > 0) h += CV_H;
    }
    return Math.max(60, h + 8);
  }

  // ============ Rendering ============

  render() {
    const { ctx, canvas } = this;
    const w = canvas.width / this._dpr;
    const h = canvas.height / this._dpr;

    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, w, h);

    if (this.voices.length === 0) {
      ctx.fillStyle = COLORS.textDim;
      ctx.font = '12px Consolas, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('(no tokens)', w / 2, h / 2);
      return;
    }

    // Ruler
    this._drawRuler(ctx, w);

    // Voices
    let y = RULER_H;
    for (let vi = 0; vi < this.voices.length; vi++) {
      y = this._drawVoice(ctx, this.voices[vi], vi, y, w);
      y += VOICE_GAP;
    }

    // Polymetric groups — brackets spanning voices
    this._drawPolyGroups(ctx, w);

    // Minimap
    this._drawMinimap(ctx, w, h);

    // Playback cursor (full height, with glow)
    if (this._cursorMs >= 0) {
      const cx = HEADER_W + this.range.msToX(this._cursorMs);
      if (cx >= HEADER_W && cx <= w) {
        // Glow
        ctx.fillStyle = COLORS.cursorGlow;
        ctx.fillRect(cx - 3, RULER_H, 6, h - RULER_H - MINIMAP_H);
        // Line
        ctx.strokeStyle = COLORS.cursor;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(cx, RULER_H);
        ctx.lineTo(cx, h - MINIMAP_H);
        ctx.stroke();
        // Triangle on ruler
        ctx.fillStyle = COLORS.cursor;
        ctx.beginPath();
        ctx.moveTo(cx - 4, RULER_H);
        ctx.lineTo(cx + 4, RULER_H);
        ctx.lineTo(cx, RULER_H - 5);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  _drawRuler(ctx, w) {
    const range = this.range;
    ctx.fillStyle = COLORS.ruler;
    ctx.fillRect(HEADER_W, 0, w - HEADER_W, RULER_H);

    ctx.fillStyle = COLORS.headerBg;
    ctx.fillRect(0, 0, HEADER_W, RULER_H);
    ctx.strokeStyle = COLORS.headerBorder;
    ctx.strokeRect(0, 0, HEADER_W, RULER_H);

    // Adaptive tick interval
    const minTickPx = 60;
    const intervals = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 30000, 60000];
    let tickMs = intervals.find(i => i * range.zoom >= minTickPx) || 60000;

    // Sub-ticks (smaller intermediate ticks)
    const subDiv = tickMs >= 1000 ? 4 : tickMs >= 200 ? 5 : 2;
    const subTickMs = tickMs / subDiv;

    const startMs = Math.floor(range.scrollMs / subTickMs) * subTickMs;
    const endMs = range.scrollMs + range.visibleMs;

    ctx.font = '10px Consolas, monospace';
    ctx.textAlign = 'left';

    for (let ms = startMs; ms <= endMs; ms += subTickMs) {
      const x = HEADER_W + range.msToX(ms);
      if (x < HEADER_W) continue;
      if (x > w) break;

      const isMajor = Math.abs(ms % tickMs) < 0.5;

      // Tick line
      ctx.strokeStyle = isMajor ? COLORS.rulerText : COLORS.rulerLine;
      ctx.lineWidth = isMajor ? 1 : 0.5;
      ctx.beginPath();
      ctx.moveTo(x, RULER_H - (isMajor ? 8 : 4));
      ctx.lineTo(x, RULER_H);
      ctx.stroke();

      // Vertical guide line through tracks
      if (isMajor) {
        ctx.strokeStyle = 'rgba(255,255,255,0.04)';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(x, RULER_H);
        ctx.lineTo(x, this._calcHeight() - MINIMAP_H);
        ctx.stroke();
      }

      // Label (major ticks only)
      if (isMajor) {
        ctx.fillStyle = COLORS.rulerText;
        const label = ms >= 1000 ? (ms / 1000).toFixed(ms % 1000 === 0 ? 0 : 1) + 's' : ms + 'ms';
        ctx.fillText(label, x + 3, RULER_H - 4);
      }
    }

    // Bottom border
    ctx.strokeStyle = COLORS.trackBorder;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, RULER_H);
    ctx.lineTo(w, RULER_H);
    ctx.stroke();
  }

  _drawVoice(ctx, voice, voiceIdx, y, w) {
    const range = this.range;

    // Track header
    ctx.fillStyle = COLORS.headerBg;
    ctx.fillRect(0, y, HEADER_W, TRACK_H);
    ctx.strokeStyle = COLORS.headerBorder;
    ctx.strokeRect(0, y, HEADER_W, TRACK_H);

    // Color dot
    ctx.fillStyle = voice.color;
    ctx.beginPath();
    ctx.arc(8, y + TRACK_H / 2, 4, 0, Math.PI * 2);
    ctx.fill();

    // Label
    ctx.fillStyle = COLORS.text;
    ctx.font = '10px Consolas, monospace';
    ctx.textAlign = 'left';
    ctx.fillText(voice.label, 16, y + TRACK_H / 2 + 4);

    // Note count
    ctx.fillStyle = COLORS.textDim;
    ctx.font = '9px Consolas, monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`${voice.notes.length}`, HEADER_W - 6, y + TRACK_H / 2 + 4);

    // Track background
    ctx.fillStyle = COLORS.trackBg;
    ctx.fillRect(HEADER_W, y, w - HEADER_W, TRACK_H);

    // Draw silences in this voice's time range
    for (const s of this.silences) {
      const sx1 = HEADER_W + range.msToX(s.start);
      const sx2 = HEADER_W + range.msToX(s.end);
      if (sx2 < HEADER_W || sx1 > w) continue;
      const csx1 = Math.max(HEADER_W, sx1);
      const csx2 = Math.min(w, sx2);
      if (csx2 - csx1 < 1) continue;
      ctx.fillStyle = COLORS.silence;
      ctx.fillRect(csx1, y, csx2 - csx1, TRACK_H);
      // Dash pattern for silence
      if (csx2 - csx1 > 12) {
        ctx.fillStyle = COLORS.textDim;
        ctx.font = '9px Consolas, monospace';
        ctx.textAlign = 'center';
        ctx.fillText('–', (csx1 + csx2) / 2, y + TRACK_H / 2 + 3);
      }
    }

    // Note blocks
    for (let bi = 0; bi < voice.notes.length; bi++) {
      const n = voice.notes[bi];
      const x1 = HEADER_W + range.msToX(n.start);
      const x2 = HEADER_W + range.msToX(n.end);

      if (x2 < HEADER_W || x1 > w) continue;
      const cx1 = Math.max(HEADER_W, x1);
      const cx2 = Math.min(w, x2);
      const cw = cx2 - cx1;
      if (cw < 0.5) continue;

      // Gaps between notes
      if (bi > 0) {
        const prev = voice.notes[bi - 1];
        if (n.start > prev.end + 1) {
          const gx1 = Math.max(HEADER_W, HEADER_W + range.msToX(prev.end));
          const gx2 = Math.min(w, x1);
          if (gx2 > gx1) {
            ctx.fillStyle = COLORS.gap;
            ctx.fillRect(gx1, y, gx2 - gx1, TRACK_H);
          }
        }
      }

      const isSelected = this._selectedBlock?.voiceIdx === voiceIdx && this._selectedBlock?.blockIdx === bi;
      const isHovered = this._hoveredBlock?.voiceIdx === voiceIdx && this._hoveredBlock?.blockIdx === bi;

      // Block fill
      const alpha = isSelected ? 1.0 : isHovered ? 0.9 : 0.75;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = bi % 2 === 0 ? voice.color : this._darken(voice.color, 0.15);
      this._roundRect(ctx, cx1, y + 1, cw, TRACK_H - 2, Math.min(BLOCK_RADIUS, cw / 2));
      ctx.fill();
      ctx.globalAlpha = 1;

      // Selection border
      if (isSelected) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;
        this._roundRect(ctx, cx1, y + 1, cw, TRACK_H - 2, Math.min(BLOCK_RADIUS, cw / 2));
        ctx.stroke();
      }

      // Label
      if (cw > 20) {
        ctx.fillStyle = '#fff';
        ctx.font = '11px Consolas, monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const maxChars = Math.floor((cw - 8) / 7);
        const label = n.token.length > maxChars ? n.token.substring(0, maxChars) : n.token;
        ctx.fillText(label, cx1 + cw / 2, y + TRACK_H / 2);
        ctx.textBaseline = 'alphabetic';
      } else if (cw > 4) {
        // Thin block — just a dot
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(cx1 + cw / 2, y + TRACK_H / 2, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Edge handles (visible on hover for future drag — Phase 3.4)
      if (isHovered && cw > 10) {
        ctx.fillStyle = COLORS.edgeHandle;
        ctx.globalAlpha = 0.5;
        // Left handle
        this._roundRect(ctx, cx1, y + 4, 3, TRACK_H - 8, 1.5);
        ctx.fill();
        // Right handle
        this._roundRect(ctx, cx2 - 3, y + 4, 3, TRACK_H - 8, 1.5);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }

    y += TRACK_H;

    // Control lane
    if (voice.controls.length > 0) {
      ctx.fillStyle = 'rgba(13, 27, 42, 0.5)';
      ctx.fillRect(HEADER_W, y, w - HEADER_W, CTRL_H);

      ctx.font = '9px Consolas, monospace';
      ctx.textAlign = 'left';

      for (const c of voice.controls) {
        const label = this._resolveControlLabel(c.token);
        if (label === null) continue; // skip scope-end markers
        const x = HEADER_W + range.msToX(c.start);
        if (x < HEADER_W || x > w) continue;
        // Vertical line
        ctx.strokeStyle = COLORS.controlMark;
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + CTRL_H);
        ctx.stroke();
        // Label
        ctx.fillStyle = COLORS.controlMark;
        ctx.fillText(label, x + 2, y + CTRL_H - 3);
      }
      y += CTRL_H;
    }

    // CV tracks
    if (voice.cv.length > 0) {
      ctx.fillStyle = COLORS.headerBg;
      ctx.fillRect(0, y, HEADER_W, CV_H);
      ctx.strokeStyle = COLORS.headerBorder;
      ctx.strokeRect(0, y, HEADER_W, CV_H);
      ctx.fillStyle = COLORS.cvMark;
      ctx.font = '9px Consolas, monospace';
      ctx.textAlign = 'left';
      ctx.beginPath();
      ctx.arc(8, y + CV_H / 2, 3, 0, Math.PI * 2);
      ctx.fill();
      const cvLabel = voice.cv[0]?.token || 'CV';
      ctx.fillText(cvLabel, 16, y + CV_H / 2 + 3);

      ctx.fillStyle = 'rgba(233, 168, 69, 0.08)';
      ctx.fillRect(HEADER_W, y, w - HEADER_W, CV_H);

      for (const cvt of voice.cv) {
        const x = HEADER_W + range.msToX(cvt.start);
        if (x < HEADER_W || x > w) continue;
        ctx.strokeStyle = COLORS.cvMark;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, y + 2);
        ctx.lineTo(x, y + CV_H - 2);
        ctx.stroke();
        // Diamond marker
        ctx.fillStyle = COLORS.cvMark;
        ctx.beginPath();
        ctx.moveTo(x, y + 3);
        ctx.lineTo(x + 3, y + CV_H / 2);
        ctx.lineTo(x, y + CV_H - 3);
        ctx.lineTo(x - 3, y + CV_H / 2);
        ctx.closePath();
        ctx.fill();
      }
      y += CV_H;
    }

    return y;
  }

  _drawPolyGroups(ctx, w) {
    if (this.polyGroups.length === 0) return;
    const range = this.range;
    const tracksTop = RULER_H;
    const tracksBottom = this._calcHeight() - MINIMAP_H - 4;

    const polyColors = [
      'rgba(0, 255, 136, 0.12)',
      'rgba(74, 144, 217, 0.12)',
      'rgba(233, 168, 69, 0.12)',
      'rgba(199, 125, 186, 0.12)',
    ];
    const polyBorders = [
      'rgba(0, 255, 136, 0.4)',
      'rgba(74, 144, 217, 0.4)',
      'rgba(233, 168, 69, 0.4)',
      'rgba(199, 125, 186, 0.4)',
    ];

    for (let gi = 0; gi < this.polyGroups.length; gi++) {
      const g = this.polyGroups[gi];
      const x1 = HEADER_W + range.msToX(g.start);
      const x2 = HEADER_W + range.msToX(g.end);
      if (x2 < HEADER_W || x1 > w) continue;

      const cx1 = Math.max(HEADER_W, x1);
      const cx2 = Math.min(w, x2);
      const cw = cx2 - cx1;
      if (cw < 2) continue;

      const ci = gi % polyColors.length;

      // Background fill
      ctx.fillStyle = polyColors[ci];
      ctx.fillRect(cx1, tracksTop, cw, tracksBottom - tracksTop);

      // Left bracket
      if (x1 >= HEADER_W) {
        ctx.strokeStyle = polyBorders[ci];
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(cx1 + 4, tracksTop + 2);
        ctx.lineTo(cx1, tracksTop + 2);
        ctx.lineTo(cx1, tracksBottom - 2);
        ctx.lineTo(cx1 + 4, tracksBottom - 2);
        ctx.stroke();
      }

      // Right bracket
      if (x2 <= w) {
        ctx.strokeStyle = polyBorders[ci];
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(cx2 - 4, tracksTop + 2);
        ctx.lineTo(cx2, tracksTop + 2);
        ctx.lineTo(cx2, tracksBottom - 2);
        ctx.lineTo(cx2 - 4, tracksBottom - 2);
        ctx.stroke();
      }

      // Voice count label at top
      if (cw > 30) {
        ctx.fillStyle = polyBorders[ci];
        ctx.font = '9px Consolas, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`{${g.voiceCount}}`, cx1 + cw / 2, tracksTop + 10);
      }
    }
  }

  _drawMinimap(ctx, w, h) {
    const mmY = h - MINIMAP_H;
    const mmW = w - HEADER_W;

    // Background
    ctx.fillStyle = COLORS.minimapBg;
    ctx.fillRect(HEADER_W, mmY, mmW, MINIMAP_H);

    // Border
    ctx.strokeStyle = COLORS.trackBorder;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(HEADER_W, mmY);
    ctx.lineTo(w, mmY);
    ctx.stroke();

    // Header
    ctx.fillStyle = COLORS.headerBg;
    ctx.fillRect(0, mmY, HEADER_W, MINIMAP_H);

    if (this.totalMs === 0) return;

    // Draw all blocks as thin rectangles
    const scale = mmW / this.totalMs;
    for (const voice of this.voices) {
      for (const n of voice.notes) {
        const x = HEADER_W + n.start * scale;
        const bw = Math.max(1, (n.end - n.start) * scale);
        ctx.fillStyle = voice.color;
        ctx.globalAlpha = 0.5;
        ctx.fillRect(x, mmY + 2, bw, MINIMAP_H - 4);
      }
    }
    ctx.globalAlpha = 1;

    // Viewport indicator
    const vpX = HEADER_W + (this.range.scrollMs * scale);
    const vpW = Math.max(4, this.range.visibleMs * scale);
    ctx.fillStyle = COLORS.minimapView;
    ctx.fillRect(vpX, mmY, vpW, MINIMAP_H);
    ctx.strokeStyle = COLORS.cursor;
    ctx.lineWidth = 0.5;
    ctx.strokeRect(vpX, mmY, vpW, MINIMAP_H);

    // Cursor position in minimap
    if (this._cursorMs >= 0) {
      const cx = HEADER_W + this._cursorMs * scale;
      ctx.strokeStyle = COLORS.cursor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx, mmY);
      ctx.lineTo(cx, mmY + MINIMAP_H);
      ctx.stroke();
    }
  }

  // ============ Playback cursor ============

  setCursor(ms) {
    this._cursorMs = ms;
    if (this._autoFollow) {
      this.range.ensureVisible(ms);
    }
    this._scheduleRender();
  }

  clearCursor() {
    this._cursorMs = -1;
    this._scheduleRender();
  }

  // ============ Events ============

  _bindEvents() {
    // Wheel: Ctrl = zoom, shift = horizontal scroll, otherwise = scroll
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left - HEADER_W;

      if (e.ctrlKey || e.metaKey) {
        const factor = e.deltaY < 0 ? 1.25 : 1 / 1.25;
        this.range.zoomAt(x, factor);
        this._autoFollow = false; // user took manual control
      } else {
        const delta = e.shiftKey ? e.deltaY : (e.deltaX || e.deltaY);
        this.range.scrollX += delta * 1.5;
        this.range.clampScroll();
        this._autoFollow = false;
      }
      this.render();
    }, { passive: false });

    // Mouse down
    this.canvas.addEventListener('mousedown', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const h = rect.height;

      // Minimap click → jump viewport
      if (my >= h - MINIMAP_H && mx > HEADER_W) {
        const mmW = rect.width - HEADER_W;
        const clickMs = ((mx - HEADER_W) / mmW) * this.totalMs;
        this.range.scrollX = (clickMs * this.range.zoom) - this.range.viewWidth / 2;
        this.range.clampScroll();
        this._autoFollow = false;
        this.render();
        return;
      }

      // Ruler click → seek
      if (my < RULER_H && mx > HEADER_W) {
        const ms = this.range.xToMs(mx - HEADER_W);
        if (this.onSeek) this.onSeek(Math.max(0, ms));
        return;
      }

      // Edge drag → resize block
      const edge = this._edgeHitTest(mx, my);
      if (edge) {
        this._isResizing = true;
        this._resizeEdge = edge;
        const n = this.voices[edge.voiceIdx].notes[edge.blockIdx];
        this._resizeOrigMs = edge.side === 'left' ? n.start : n.end;
        this.canvas.style.cursor = 'col-resize';
        e.preventDefault();
        return;
      }

      // Block click → select
      const hit = this._hitTest(mx, my);
      if (hit) {
        this._selectedBlock = hit;
        if (this.onSelect) {
          const n = this.voices[hit.voiceIdx].notes[hit.blockIdx];
          this.onSelect(n, hit.voiceIdx, hit.blockIdx);
        }
        this.render();
        return;
      }

      // Drag to scroll
      this._isDragging = true;
      this._dragStartX = e.clientX;
      this._dragStartScroll = this.range.scrollX;
      this.canvas.style.cursor = 'grabbing';
      this._autoFollow = false;
    });

    // Double-click → fit to view
    this.canvas.addEventListener('dblclick', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const my = e.clientY - rect.top;
      if (my > RULER_H) {
        this.range.fitToView();
        this._autoFollow = true;
        this.render();
      }
    });

    this.canvas.addEventListener('mousemove', (e) => {
      // Edge resize in progress
      if (this._isResizing && this._resizeEdge) {
        const rect = this.canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const newMs = Math.max(0, Math.min(this.totalMs, this.range.xToMs(mx - HEADER_W)));
        const { voiceIdx, blockIdx, side } = this._resizeEdge;
        const voice = this.voices[voiceIdx];
        const n = voice.notes[blockIdx];

        if (side === 'right') {
          // Don't shrink past start + min, don't overlap next block
          const minEnd = n.start + 10;
          const maxEnd = blockIdx < voice.notes.length - 1 ? voice.notes[blockIdx + 1].start : this.totalMs;
          n.end = Math.round(Math.max(minEnd, Math.min(maxEnd, newMs)));
        } else {
          // Don't grow past end - min, don't overlap previous block
          const maxStart = n.end - 10;
          const minStart = blockIdx > 0 ? voice.notes[blockIdx - 1].end : 0;
          n.start = Math.round(Math.max(minStart, Math.min(maxStart, newMs)));
        }
        this.render();
        return;
      }

      if (this._isDragging) {
        const dx = e.clientX - this._dragStartX;
        this.range.scrollX = this._dragStartScroll - dx;
        this.range.clampScroll();
        this.render();
        return;
      }

      const rect = this.canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      // Check edge hover
      const edge = this._edgeHitTest(mx, my);
      const prevEdge = this._hoveredEdge;
      this._hoveredEdge = edge;

      // Check block hover
      const hit = this._hitTest(mx, my);
      const prev = this._hoveredBlock;
      this._hoveredBlock = hit;

      if (edge) {
        this.canvas.style.cursor = 'col-resize';
        const en = this.voices[edge.voiceIdx].notes[edge.blockIdx];
        this.canvas.title = `Drag to resize ${en.token} (${en.end - en.start}ms)`;
      } else if (hit) {
        this.canvas.style.cursor = 'pointer';
        const n = this.voices[hit.voiceIdx].notes[hit.blockIdx];
        const dur = n.end - n.start;
        this.canvas.title = `${n.token}: ${n.start}–${n.end}ms (${dur}ms)`;
      } else if (my >= rect.height - MINIMAP_H && mx > HEADER_W) {
        this.canvas.style.cursor = 'pointer';
        this.canvas.title = 'Click to navigate';
      } else {
        this.canvas.style.cursor = mx > HEADER_W ? 'grab' : 'default';
        this.canvas.title = '';
      }

      if (hit?.voiceIdx !== prev?.voiceIdx || hit?.blockIdx !== prev?.blockIdx
          || edge?.blockIdx !== prevEdge?.blockIdx || edge?.side !== prevEdge?.side) {
        this.render();
      }
    });

    window.addEventListener('mouseup', () => {
      if (this._isResizing && this._resizeEdge) {
        const { voiceIdx, blockIdx, side } = this._resizeEdge;
        const n = this.voices[voiceIdx].notes[blockIdx];
        this._isResizing = false;
        this.canvas.style.cursor = 'grab';
        // Notify: block was resized
        if (this.onResize) {
          this.onResize(voiceIdx, blockIdx, n.start, n.end);
        }
        this._resizeEdge = null;
        this.render();
        return;
      }
      if (this._isDragging) {
        this._isDragging = false;
        this.canvas.style.cursor = 'grab';
      }
    });

    // Resize observer
    if (window.ResizeObserver && this.canvas.parentElement) {
      this._resizeObs = new ResizeObserver(() => {
        this.resize();
        this.render();
      });
      this._resizeObs.observe(this.canvas.parentElement);
    }
  }

  _hitTest(mx, my) {
    let y = RULER_H;
    for (let vi = 0; vi < this.voices.length; vi++) {
      const voice = this.voices[vi];
      if (my >= y && my < y + TRACK_H) {
        for (let bi = 0; bi < voice.notes.length; bi++) {
          const n = voice.notes[bi];
          const x1 = HEADER_W + this.range.msToX(n.start);
          const x2 = HEADER_W + this.range.msToX(n.end);
          if (mx >= x1 && mx <= x2) {
            return { voiceIdx: vi, blockIdx: bi };
          }
        }
      }
      y += TRACK_H;
      if (voice.controls.length > 0) y += CTRL_H;
      if (voice.cv.length > 0) y += CV_H;
      y += VOICE_GAP;
    }
    return null;
  }

  _edgeHitTest(mx, my) {
    let y = RULER_H;
    for (let vi = 0; vi < this.voices.length; vi++) {
      const voice = this.voices[vi];
      if (my >= y && my < y + TRACK_H) {
        for (let bi = 0; bi < voice.notes.length; bi++) {
          const n = voice.notes[bi];
          const x1 = HEADER_W + this.range.msToX(n.start);
          const x2 = HEADER_W + this.range.msToX(n.end);
          if (Math.abs(mx - x1) <= EDGE_HANDLE_W && bi > 0) {
            return { voiceIdx: vi, blockIdx: bi, side: 'left' };
          }
          if (Math.abs(mx - x2) <= EDGE_HANDLE_W) {
            return { voiceIdx: vi, blockIdx: bi, side: 'right' };
          }
        }
      }
      y += TRACK_H;
      if (voice.controls.length > 0) y += CTRL_H;
      if (voice.cv.length > 0) y += CV_H;
      y += VOICE_GAP;
    }
    return null;
  }

  // ============ Helpers ============

  _resolveControlLabel(token) {
    // _script(CT 0) or _script(CT0) → look up in controlTable
    const scriptMatch = token.match(/^_script\((.+)\)$/);
    if (scriptMatch) {
      const ctId = scriptMatch[1].trim();
      if (this._controlTable) {
        // Try exact match, then trimmed/normalized match
        const entry = this._controlTable.find(e =>
          e.id === ctId || e.id.replace(/\s+/g, '') === ctId.replace(/\s+/g, '')
        );
        if (entry?.assignments && typeof entry.assignments === 'object') {
          const pairs = Object.entries(entry.assignments);
          if (pairs.length > 0) {
            return pairs.map(([k, v]) => `${k}:${v}`).join(', ');
          }
          // scope end — empty assignments
          if (entry.scope === 'end') return null; // hide end markers
        }
      }
      // _e suffix = scope end, hide it
      if (ctId.endsWith('_e')) return null;
      return ctId;
    }
    // _vel(80) → vel:80, _chan(1) → chan:1
    const directMatch = token.match(/^_(\w+)\((.+)\)$/);
    if (directMatch) {
      return `${directMatch[1]}:${directMatch[2]}`;
    }
    return token;
  }

  _scheduleRender() {
    if (this._animFrame) return;
    this._animFrame = requestAnimationFrame(() => {
      this._animFrame = 0;
      this.render();
    });
  }

  _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }

  _darken(hex, amount) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const f = 1 - amount;
    return `rgb(${Math.round(r * f)}, ${Math.round(g * f)}, ${Math.round(b * f)})`;
  }

  destroy() {
    if (this._resizeObs) this._resizeObs.disconnect();
    if (this._animFrame) cancelAnimationFrame(this._animFrame);
  }
}
