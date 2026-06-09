const config = require('../tailwind.config.ts').default;

const palette = config.theme?.extend?.colors as Record<string, any>;
const slate200 = palette?.slate?.[200];

if (slate200 === '#722F37') {
  throw new Error('Tailwind slate palette is incorrectly mapped to the brand brown color.');
}

console.log('Tailwind palette check passed. slate[200]=', slate200);
