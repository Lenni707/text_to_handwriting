/**
 * Handwriting Engine
 * Renders typed text onto a canvas using stored stroke profile data.
 * Applies natural handwriting distortions: jitter, slant, pressure variation,
 * baseline variation, and optional cursive connectors.
 */

const HandwritingEngine = (() => {

  // Seeded random for repeatable renders (per character position)
  function seededRandom(seed) {
    let s = seed;
    return function () {
      s = (s * 16807 + 0) % 2147483647;
      return (s - 1) / 2147483646;
    };
  }

  // Smooth a polyline with bezier curves
  function drawSmoothStroke(ctx, points, lineWidth, color) {
    if (!points || points.length === 0) return;

    if (points.length === 1) {
      ctx.save();
      ctx.beginPath();
      ctx.fillStyle = color;
      const r = Math.max(0.5, (lineWidth * (points[0].pressure || 0.5)) / 2);
      ctx.arc(points[0].x, points[0].y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }

    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (points.length === 2) {
      ctx.lineWidth = lineWidth * (points[0].pressure || 0.5);
      ctx.moveTo(points[0].x, points[0].y);
      ctx.lineTo(points[1].x, points[1].y);
      ctx.stroke();
      return;
    }

    // Draw with pressure-varying width using individual segments
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[Math.max(0, i - 1)];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[Math.min(points.length - 1, i + 2)];

      // Cardinal spline control points
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      // Pressure interpolation: thin at ends, thick in middle
      const t = points.length > 2 ? i / (points.length - 2) : 0.5;
      const pressureBell = Math.sin(Math.PI * t);
      const p = (p1.pressure || 0.5);
      const pressure = p * 0.4 + pressureBell * p * 0.6;

      ctx.beginPath();
      ctx.lineWidth = Math.max(0.5, lineWidth * pressure);
      ctx.moveTo(p1.x, p1.y);
      ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
      ctx.stroke();
    }
  }

  // Apply jitter noise to a point
  function jitterPoint(x, y, amount, rng) {
    return {
      x: x + (rng() - 0.5) * amount * 2,
      y: y + (rng() - 0.5) * amount * 2,
    };
  }

  // Get bounding box of all points in a character
  function getCharBounds(points) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const pt of points) {
      if (pt) {
        minX = Math.min(minX, pt.x);
        minY = Math.min(minY, pt.y);
        maxX = Math.max(maxX, pt.x);
        maxY = Math.max(maxY, pt.y);
      }
    }
    if (minX === Infinity) return { minX: 0, minY: 0, maxX: 1, maxY: 1, w: 1, h: 1 };
    return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
  }

  // Draw a single character's strokes onto the context at position (x, y)
  // charData: array of strokes, each stroke is array of {x,y,pressure} (normalized 0-1)
  // fontSize: target pixel height for the character
  function renderChar(ctx, charData, x, y, fontSize, slantAngle, jitterAmount, inkColor, charSeed) {
    if (!charData || charData.length === 0) return { width: fontSize * 0.55 };

    const rng = seededRandom(charSeed);
    const bounds = getCharBounds(charData.flat());
    const scaleY = fontSize;
    const scaleX = fontSize * (400 / 300);

    // Effective character width
    const charWidth = Math.max(bounds.w * scaleX, fontSize * 0.2);
    const slantRad = (slantAngle * Math.PI) / 180;

    ctx.save();
    // Apply slant as a horizontal shear
    ctx.transform(1, 0, Math.tan(slantRad), 1, x, y);

    for (const stroke of charData) {
      if (!stroke || stroke.length === 0) continue;

      // Transform normalized coords to canvas coords
      const transformed = stroke.map((pt) => {
        const sx = (pt.x - bounds.minX) * scaleX;
        const sy = (pt.y - 0.7) * scaleY;
        const jitter = jitterAmount * fontSize * 0.08;
        const jp = jitterPoint(sx, sy, jitter, rng);
        return {
          x: jp.x,
          y: jp.y,
          pressure: pt.pressure !== undefined ? pt.pressure : 0.6,
        };
      });

      drawSmoothStroke(ctx, transformed, fontSize * 0.04, inkColor);
    }

    ctx.restore();

    return { width: charWidth, firstStroke: charData[0], lastStroke: charData[charData.length - 1] };
  }

  // Draw cursive connector from last point of previous char to first point of next char
  function drawConnector(ctx, fromX, fromY, toX, toY, lineWidth, inkColor) {
    if (!fromX || !fromY || !toX || !toY) return;
    ctx.save();
    ctx.beginPath();
    ctx.strokeStyle = inkColor;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.globalAlpha = 0.5;
    // Slight curve downward for natural look
    const cpX = (fromX + toX) / 2;
    const cpY = Math.max(fromY, toY) + lineWidth * 3;
    ctx.moveTo(fromX, fromY);
    ctx.quadraticCurveTo(cpX, cpY, toX, toY);
    ctx.stroke();
    ctx.restore();
  }

  /**
   * Main render function.
   * @param {HTMLCanvasElement} canvas - output canvas
   * @param {string} text - input text
   * @param {Object} profile - handwriting profile with .characters
   * @param {Object} options - rendering options
   */
  function render(canvas, text, profile, options = {}) {
    const {
      fontSize = 32,
      lineSpacing = 1.6,
      letterSpacing = 2,
      slantAngle = -5,
      jitter = 20,
      inkColor = '#1a2744',
      cursive = false,
      paperPadding = 48,
      showRules = true,
    } = options;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!text || !profile || !profile.characters) return;

    const chars = profile.characters;
    const lineHeight = fontSize * lineSpacing;
    const maxWidth = canvas.width - paperPadding * 2;

    // Tokenize text into lines (split on \n), then wrap long lines
    const inputLines = text.split('\n');
    const renderLines = [];

    for (const inputLine of inputLines) {
      if (inputLine.trim() === '') {
        renderLines.push([]);
        continue;
      }
      // Word-wrap
      const words = inputLine.split(' ');
      let currentLine = [];
      let currentWidth = 0;
 
      for (const word of words) {
        const wordChars = word.split('');
        let wordWidth = 0;
        for (const ch of wordChars) {
          const cd = chars[ch];
          const bounds = cd ? getCharBounds(cd.flat()) : null;
          const scaleX = fontSize * (400 / 300);
          const cw = bounds ? Math.max(bounds.w * scaleX, fontSize * 0.2) : fontSize * 0.45;
          wordWidth += cw + letterSpacing;
        }
        wordWidth += fontSize * 0.4; // space

        if (currentWidth + wordWidth > maxWidth && currentLine.length > 0) {
          renderLines.push(currentLine);
          currentLine = [];
          currentWidth = 0;
        }

        // Add each character of the word
        for (const ch of wordChars) {
          currentLine.push(ch);
        }
        currentLine.push(' ');
        currentWidth += wordWidth;
      }
      if (currentLine.length > 0) {
        renderLines.push(currentLine);
      }
    }

    // Compute total height needed
    const totalHeight = paperPadding * 2 + renderLines.length * lineHeight + fontSize;
    if (canvas.height !== totalHeight) {
      canvas.height = Math.max(totalHeight, 200);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    if (showRules) {
      // Draw ruled lines simulating a block notepad (lines to the bottom)
      ctx.save();
      ctx.strokeStyle = 'rgba(37, 99, 235, 0.15)'; // realistic college block blue lines
      ctx.lineWidth = 1;
      const numLines = Math.ceil((canvas.height - paperPadding) / lineHeight);
      for (let lineIdx = 0; lineIdx < numLines; lineIdx++) {
        const lineY = paperPadding + lineIdx * lineHeight + fontSize * 0.85;
        ctx.beginPath();
        ctx.moveTo(paperPadding, lineY);
        ctx.lineTo(canvas.width - paperPadding, lineY);
        ctx.stroke();
      }
      // Left margin line
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.22)'; // realistic red margin line
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(paperPadding + 20, 0);
      ctx.lineTo(paperPadding + 20, canvas.height);
      ctx.stroke();
      ctx.restore();
    }


    // Render each character
    let charSeedBase = 1;

    for (let lineIdx = 0; lineIdx < renderLines.length; lineIdx++) {
      const line = renderLines[lineIdx];
      const baseY = paperPadding + lineIdx * lineHeight;

      // Baseline RNG for this line
      const lineRng = seededRandom(lineIdx * 997 + 1);
      let curX = paperPadding + 28; // after margin line
      let prevEndX = null;
      let prevEndY = null;
      let prevCh = null;

      for (let ci = 0; ci < line.length; ci++) {
        const ch = line[ci];

        if (ch === ' ') {
          curX += fontSize * 0.42 + (lineRng() - 0.5) * letterSpacing * 0.5;
          prevEndX = null;
          prevEndY = null;
          prevCh = null;
          continue;
        }

        const charData = chars[ch];
        const baselineJitter = (lineRng() - 0.5) * 5;
        const charY = baseY + baselineJitter;
        const charSeed = charSeedBase++ + ch.charCodeAt(0) * 31;

        if (charData && charData.length > 0) {
          const result = renderChar(ctx, charData, curX, charY, fontSize, slantAngle, jitter / 25, inkColor, charSeed);
          const charW = result.width;

          // Cursive connectors
          const isPrevLetter = prevCh && /[a-zA-Z]/.test(prevCh);
          const isCurLetter = ch && /[a-zA-Z]/.test(ch);
          if (cursive && prevEndX !== null && isPrevLetter && isCurLetter) {
            // Get start of current char
            const bounds = getCharBounds(charData.flat());
            const scaleX = fontSize * (400 / 300);
            const scaleY = fontSize;
            const slantRad = (slantAngle * Math.PI) / 180;
            const startPt = charData[0][0];
            if (startPt) {
              const lx = (startPt.x - bounds.minX) * scaleX;
              const ly = (startPt.y - 0.7) * scaleY;
              const toX = curX + lx + ly * Math.tan(slantRad);
              const toY = charY + ly;
              drawConnector(ctx, prevEndX, prevEndY, toX, toY, fontSize * 0.025, inkColor);
            }
          }

          // Track end point for cursive
          if (cursive) {
            const bounds = getCharBounds(charData.flat());
            const scaleX = fontSize * (400 / 300);
            const scaleY = fontSize;
            const slantRad = (slantAngle * Math.PI) / 180;
            const lastStroke = charData[charData.length - 1];
            if (lastStroke && lastStroke.length > 0) {
              const lastPt = lastStroke[lastStroke.length - 1];
              const lx_prev = (lastPt.x - bounds.minX) * scaleX;
              const ly_prev = (lastPt.y - 0.7) * scaleY;
              prevEndX = curX + lx_prev + ly_prev * Math.tan(slantRad);
              prevEndY = charY + ly_prev;
            }
          }

          curX += charW + letterSpacing + (lineRng() - 0.5) * 2;
          prevCh = ch;
        } else {
          // Fallback: draw character as text (no stroke data)
          ctx.save();
          ctx.font = `${fontSize}px Georgia, serif`;
          ctx.fillStyle = inkColor;
          ctx.globalAlpha = 0.35;
          ctx.fillText(ch, curX, charY + fontSize * 0.8);
          ctx.restore();
          curX += fontSize * 0.55 + letterSpacing;
          prevEndX = null;
          prevEndY = null;
          prevCh = null;
        }
      }
    }
  }

  return { render };
})();
