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
  function drawSmoothStroke(ctx, points, lineWidth, color, penStyle = 'digital') {
    if (!points || points.length === 0) return;

    if (points.length === 1) {
      ctx.save();
      ctx.beginPath();
      ctx.fillStyle = color;
      const pt = points[0];
      const p = penStyle === 'digital' ? 1.0 : (pt.pressure || 0.5);
      const r = Math.max(0.5, (lineWidth * p) / 2);
      ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }

    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (points.length === 2) {
      const p = penStyle === 'digital' ? 1.0 : (points[0].pressure || 0.5);
      ctx.lineWidth = lineWidth * p;
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

      // Pressure interpolation based on selected style
      const t = points.length > 2 ? i / (points.length - 2) : 0.5;
      const pressureBell = Math.sin(Math.PI * t);
      const p = (p1.pressure || 0.5);
      
      let pressure = 1.0;
      if (penStyle === 'fountain') {
        pressure = 0.75 + (p - 0.5) * 0.4 + pressureBell * 0.2;
      } else if (penStyle === 'ballpoint') {
        pressure = 0.55 + (p - 0.5) * 0.65 + pressureBell * 0.35;
      } else { // 'digital'
        pressure = 0.96 + (p - 0.5) * 0.08; // extremely clean and consistent
      }

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
  function renderChar(ctx, charData, x, y, fontSize, slantAngle, jitterAmount, inkColor, charSeed, penStyle = 'digital', strokeWidth = 1.0) {
    if (!charData || charData.length === 0) return { width: fontSize * 0.55 };

    const rng = seededRandom(charSeed);
    const bounds = getCharBounds(charData.flat());
    const scaleY = fontSize;
    const scaleX = fontSize * (400 / 300);

    // Character-level transformations for natural variation (rotation, scale, offsets)
    // rather than shaky, high-frequency point jitter
    const dx = (rng() - 0.5) * jitterAmount * fontSize * 0.12;
    const dy = (rng() - 0.5) * jitterAmount * fontSize * 0.08;
    const scaleXVar = 1.0 + (rng() - 0.5) * jitterAmount * 0.08;
    const scaleYVar = 1.0 + (rng() - 0.5) * jitterAmount * 0.08;
    const rotateVar = (rng() - 0.5) * jitterAmount * 0.05; // radians

    const charWidth = Math.max(bounds.w * scaleX * scaleXVar, fontSize * 0.25);
    const slantRad = (slantAngle * Math.PI) / 180;

    ctx.save();
    // Apply slant as horizontal shear + translate to local character origin
    ctx.transform(1, 0, Math.tan(slantRad), 1, x, y);

    const cosR = Math.cos(rotateVar);
    const sinR = Math.sin(rotateVar);

    for (const stroke of charData) {
      if (!stroke || stroke.length === 0) continue;

      // Transform normalized coords with character-level rotation & scaling
      const transformed = stroke.map((pt) => {
        // 1. Initial scale from normalized space
        const sxRaw = (pt.x - bounds.minX) * scaleX * scaleXVar;
        const syRaw = (pt.y - 0.7) * scaleY * scaleYVar;

        // 2. Rotate around character anchor point
        const rx = sxRaw * cosR - syRaw * sinR;
        const ry = sxRaw * sinR + syRaw * cosR;

        // 3. Add character offset + tiny hand micro-jitter for natural feel
        const microJitter = jitterAmount * fontSize * 0.006;
        const jp = jitterPoint(rx + dx, ry + dy, microJitter, rng);

        return {
          x: jp.x,
          y: jp.y,
          pressure: pt.pressure !== undefined ? pt.pressure : 0.6,
        };
      });

      drawSmoothStroke(ctx, transformed, fontSize * 0.038 * strokeWidth, inkColor, penStyle);
    }

    ctx.restore();

    return { width: charWidth, firstStroke: charData[0], lastStroke: charData[charData.length - 1] };
  }

  // Predict the best exit connection point on a character's strokes
  function getExitPoint(charData, bounds) {
    if (!charData || charData.length === 0) return null;
    let bestPt = null;
    let maxScore = -Infinity;

    for (const stroke of charData) {
      if (!stroke || stroke.length === 0) continue;
      // Exit point is usually the last point of a stroke
      const pt = stroke[stroke.length - 1];
      const normX = (pt.x - bounds.minX) / (bounds.w || 1);
      const normY = pt.y;

      let yScore = 1.0;
      if (normY < 0.35) yScore = 0.1;       // penalize top accent marks/crossbars
      else if (normY > 0.95) yScore = 0.2;  // penalize descender loops
      else {
        // favor typical middle-to-baseline heights (0.5 to 0.8)
        yScore = 1.0 - Math.abs(normY - 0.65) * 1.5;
      }

      const score = normX * 1.8 + yScore;
      if (score > maxScore) {
        maxScore = score;
        bestPt = pt;
      }
    }

    if (!bestPt) {
      const lastStroke = charData[charData.length - 1];
      bestPt = lastStroke[lastStroke.length - 1];
    }
    return bestPt;
  }

  // Predict the best entry connection point on a character's strokes
  function getEntryPoint(charData, bounds) {
    if (!charData || charData.length === 0) return null;
    let bestPt = null;
    let maxScore = -Infinity;

    for (const stroke of charData) {
      if (!stroke || stroke.length === 0) continue;
      // Entry point is usually the first point of a stroke
      const pt = stroke[0];
      const normX = (pt.x - bounds.minX) / (bounds.w || 1);
      const normY = pt.y;

      let yScore = 1.0;
      if (normY < 0.35) yScore = 0.1;       // penalize top entries
      else if (normY > 0.95) yScore = 0.2;  // penalize bottom descender loops
      else {
        // favor baseline entry heights (around 0.65-0.75)
        yScore = 1.0 - Math.abs(normY - 0.7) * 1.5;
      }

      const score = (1.0 - normX) * 1.8 + yScore;
      if (score > maxScore) {
        maxScore = score;
        bestPt = pt;
      }
    }

    if (!bestPt) {
      bestPt = charData[0][0];
    }
    return bestPt;
  }

  // Draw cursive connector with smart bridge vs cup curve heuristics
  function drawConnector(ctx, fromX, fromY, toX, toY, lineWidth, inkColor, fromNormY = 0.7, toNormY = 0.7) {
    if (!fromX || !fromY || !toX || !toY) return;
    ctx.save();
    ctx.beginPath();
    ctx.strokeStyle = inkColor;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.globalAlpha = 0.75;

    const dx = toX - fromX;
    const cpX = fromX + dx * 0.5;

    let cpY;
    if (fromNormY < 0.55) {
      // High exit (o, v, w, b) -> smooth downward bridge/slide curve
      cpY = fromY + (toY - fromY) * 0.3;
    } else {
      // Baseline exit (a, c, d, etc.) -> natural baseline cup curve
      cpY = Math.max(fromY, toY) + lineWidth * 2.8;
    }

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
      baselineJitter = 3,
      strokeWidth = 1.0,
      penStyle = 'digital',
      inkColor = '#1a2744',
      cursive = false,
      paperPadding = 48,
      showRules = true,
    } = options;

    const ctx = canvas.getContext('2d');

    if (!text || !profile || !profile.characters) {
      // Clear canvas if empty text or invalid profile
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
      return;
    }

    // Use a minimum DPR of 2 for super-sampling (renders ultra-sharp even on non-Retina displays)
    const dpr = Math.max(2, window.devicePixelRatio || 1);

    // Get layout width (CSS pixels, rounded to prevent subpixel scaling blur)
    const layoutWidth = Math.round(options.width || canvas.clientWidth || 700);

    const chars = profile.characters;
    const lineHeight = fontSize * lineSpacing;
    const maxWidth = layoutWidth - paperPadding * 2;

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

    // Compute total height needed (CSS pixels, rounded to prevent subpixel scaling blur)
    const totalHeight = paperPadding * 2 + renderLines.length * lineHeight + fontSize;
    const layoutHeight = Math.round(Math.max(totalHeight, 200));

    // Only update backing store size if it has changed to prevent resetting the context
    const targetBackingWidth = Math.round(layoutWidth * dpr);
    const targetBackingHeight = Math.round(layoutHeight * dpr);

    if (canvas.width !== targetBackingWidth || canvas.height !== targetBackingHeight) {
      canvas.width = targetBackingWidth;
      canvas.height = targetBackingHeight;
    }

    // Always enforce exact matching CSS styles to prevent browser interpolation blur
    canvas.style.width = layoutWidth + 'px';
    canvas.style.height = layoutHeight + 'px';

    // Set up Retina scaling and clear the canvas
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();

    ctx.save();
    ctx.scale(dpr, dpr);

    if (showRules) {
      // Draw ruled lines simulating a block notepad (lines to the bottom)
      ctx.save();
      ctx.strokeStyle = 'rgba(37, 99, 235, 0.15)'; // realistic college block blue lines
      ctx.lineWidth = 1;
      const numLines = Math.ceil((layoutHeight - paperPadding) / lineHeight);
      for (let lineIdx = 0; lineIdx < numLines; lineIdx++) {
        const lineY = paperPadding + lineIdx * lineHeight + fontSize * 0.85;
        ctx.beginPath();
        ctx.moveTo(paperPadding, lineY);
        ctx.lineTo(layoutWidth - paperPadding, lineY);
        ctx.stroke();
      }
      // Left margin line
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.22)'; // realistic red margin line
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(paperPadding + 20, 0);
      ctx.lineTo(paperPadding + 20, layoutHeight);
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
      let prevNormY = null;
      let prevCh = null;

      for (let ci = 0; ci < line.length; ci++) {
        const ch = line[ci];

        if (ch === ' ') {
          curX += fontSize * 0.42 + (lineRng() - 0.5) * letterSpacing * 0.5;
          prevEndX = null;
          prevEndY = null;
          prevNormY = null;
          prevCh = null;
          continue;
        }

        const charData = chars[ch];
        const baselineOffset = (lineRng() - 0.5) * baselineJitter;
        const charY = baseY + baselineOffset;
        const charSeed = charSeedBase++ + ch.charCodeAt(0) * 31;

        if (charData && charData.length > 0) {
          const result = renderChar(ctx, charData, curX, charY, fontSize, slantAngle, jitter / 25, inkColor, charSeed, penStyle, strokeWidth);
          const charW = result.width;

          // Cursive connectors
          const isPrevLetter = prevCh && /[a-zA-ZäöüßÄÖÜ]/.test(prevCh);
          const isCurLetter = ch && /[a-zA-ZäöüßÄÖÜ]/.test(ch);
          if (cursive && prevEndX !== null && isPrevLetter && isCurLetter) {
            // Predict entry point of current character
            const bounds = getCharBounds(charData.flat());
            const scaleX = fontSize * (400 / 300);
            const scaleY = fontSize;
            const slantRad = (slantAngle * Math.PI) / 180;
            const entryPt = getEntryPoint(charData, bounds);
            if (entryPt) {
              const lx = (entryPt.x - bounds.minX) * scaleX;
              const ly = (entryPt.y - 0.7) * scaleY;
              const toX = curX + lx + ly * Math.tan(slantRad);
              const toY = charY + ly;
              // Pass the normal Y heights to calculate smart curve shapes
              drawConnector(ctx, prevEndX, prevEndY, toX, toY, fontSize * 0.025 * strokeWidth, inkColor, prevNormY, entryPt.y);
            }
          }

          // Track end point (exit point) for next cursive connection
          if (cursive) {
            const bounds = getCharBounds(charData.flat());
            const scaleX = fontSize * (400 / 300);
            const scaleY = fontSize;
            const slantRad = (slantAngle * Math.PI) / 180;
            const exitPt = getExitPoint(charData, bounds);
            if (exitPt) {
              const lx_prev = (exitPt.x - bounds.minX) * scaleX;
              const ly_prev = (exitPt.y - 0.7) * scaleY;
              prevEndX = curX + lx_prev + ly_prev * Math.tan(slantRad);
              prevEndY = charY + ly_prev;
              prevNormY = exitPt.y;
            } else {
              prevEndX = null;
              prevEndY = null;
              prevNormY = null;
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
          prevNormY = null;
          prevCh = null;
        }
      }
    }

    ctx.restore();
  }

  return { render };
})();
