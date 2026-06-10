import tailwindConfig from '../tailwind.config';

const palette = tailwindConfig.theme?.extend?.colors as Record<string, unknown> | undefined;
const slate = palette?.slate as Record<string, string> | undefined;
const slate200 = slate?.['200'];

if (slate200 === '#722F37') {
  throw new Error('Tailwind slate palette is incorrectly mapped to the brand brown color.');
}

console.log('Tailwind palette check passed. slate[200]=', slate200);

export {};
