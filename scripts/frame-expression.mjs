const property = id => `--${id.replaceAll('.', '-')}`;
const starts = (id, prefixes) => prefixes.some(prefix => id === prefix || id.startsWith(prefix + '.'));

// These are token concerns, not world-name or publication branches.
const concerns = {
  material: id => id.startsWith('color.') && !id.startsWith('color.crossing.') || starts(id, ['world.material', 'material.stock', 'material.emulsion', 'material.anodised', 'material.phosphor', 'material.optical']) && !starts(id, ['world.material.raster']),
  raster: id => starts(id, ['world.material.raster']),
  geometry: id => starts(id, ['world.geometry', 'radius']),
  depth: id => starts(id, ['world.depth', 'elevation.shell', 'elevation.plate', 'elevation.popover']),
  emission: id => starts(id, ['world.illumination', 'illumination']),
  type: id => starts(id, ['world.type', 'type.family', 'type.weight', 'type.size', 'type.line-height', 'type.tracking', 'type.optical-size', 'type.numeric']),
  motion: id => starts(id, ['world.motion', 'duration.expressive', 'motion.reduced.expressive', 'motion.reduced.decay', 'easing.productive']),
  crop: id => starts(id, ['world.crop']),
  figure: id => starts(id, ['world.figure']),
};

export function buildFrameExpression({ tokens, patterns: worldPatterns, cssValue }) {
  const rules = [];
  function record(id) {
    const token = tokens[id];
    if (!token) throw new Error(`Missing expression token ${id}`);
    const type = token.$type;
    let value = token.$value, unit = token.$extensions?.['design-tokens.unit'];
    if ((type === 'dimension' || type === 'duration') && value && typeof value === 'object') {
      unit = value.unit; value = value.value;
    }
    const css = ['px', 'rem', 'em', 'ch', 'deg', 's', 'ms'].includes(unit) && typeof value === 'number' ? `${value}${unit}` : cssValue(id);
    const result = { type, value, css };
    if (unit) result.unit = unit;
    return result;
  }
  const policyFor = (id, item) => id.startsWith('frame.') ? 'output' : item.type === 'dimension' || item.type === 'duration' || item.unit === 's' ? 'scale' : 'inherit';
  const frameType = record('frame.type.body'), readingType = record('type.size.body');
  if (frameType.unit !== readingType.unit || !(readingType.value > 0)) throw new Error('Frame and reading type need comparable positive units');
  const sizeScale = frameType.value / readingType.value;
  const milliseconds = item => item.value * (item.unit === 's' ? 1000 : item.unit === 'ms' ? 1 : NaN);
  const transition = record('frame.duration.transition'), expressive = record('duration.expressive');
  const motionScale = milliseconds(transition) / milliseconds(expressive);
  if (!(sizeScale > 0) || !(motionScale > 0)) throw new Error('Invalid frame adaptation scale');
  const derivedDuration = value => ({ type: 'duration', value, unit: 'ms', css: `${value}ms` });
  const adaptation = {
    sizeScale, motionScale,
    type: Object.fromEntries(['title', 'body', 'caption'].map(name => [name, record(`frame.type.${name}`)])),
    safe: Object.fromEntries(['action', 'title'].map(name => [name, record(`frame.safe.${name}`)])),
    motion: {
      transition,
      readingHold: record('frame.duration.reading-hold'),
      expressiveDuration: derivedDuration(milliseconds(transition) * tokens['world.motion.expressive-scale'].$value),
      emissionDecay: derivedDuration(milliseconds(record('world.motion.decay')) * motionScale),
    },
  };
  const expression = {};
  for (const [group, contains] of Object.entries(concerns)) {
    const values = {}, patterns = {};
    for (const id of Object.keys(tokens).sort().filter(contains)) {
      const item = record(id), policy = policyFor(id, item); values[id] = item;
      const name = property(id); rules.push(`  ${name}: ${item.css};`);
      if (policy === 'scale') {
        const scale = item.type === 'duration' || item.unit === 's' ? 'motion' : 'size';
        const adapted = `--frame-${id.replaceAll('.', '-')}`;
        rules.push(`  ${adapted}: calc(var(${name}) * var(--frame-${scale}-scale));`);
      }
    }
    for (const [id, value] of worldPatterns) if (contains(id)) {
      const name = property(id) + '-pattern';
      patterns[id] = { type: 'pattern', value, css: value };
      rules.push(`  ${name}: ${value};`);
    }
    expression[group] = { tokens: values, patterns };
  }
  for (const [name, value] of [
    ['frame-size-scale', sizeScale],
    ['frame-motion-scale', motionScale],
    ['frame-expressive-duration', adaptation.motion.expressiveDuration.css],
    ['frame-emission-decay', adaptation.motion.emissionDecay.css],
  ]) {
    rules.push(`  --${name}: ${value};`);
  }
  return { expression, adaptation, rules };
}
