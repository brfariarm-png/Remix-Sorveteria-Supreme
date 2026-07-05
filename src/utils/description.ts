/**
 * Helper to clean up product descriptions when sizeMode is 'single'.
 * Removes references to choosing sizes, ingredients, bases, or flavor lists.
 */
export function cleanDescriptionForSingleSize(description: string): string {
  if (!description) return '';
  let cleaned = description;

  // List of terms/phrases to remove case-insensitively
  const phrasesToRemove = [
    /escolha o tamanho da sua vontade, temos 4 tamanhos e em todos com cortesia leite condensado, leite em po, banana, morango e granola\.?/gi,
    /escolha o tamanho da sua vontade, temos \d+ tamanhos\.?/gi,
    /escolha o tamanho da sua vontade\.?/gi,
    /temos 4 tamanhos e em todos com cortesia leite condensado, leite em po, banana, morango e granola\.?/gi,
    /temos \d+ tamanhos\.?/gi,
    /escolha seu tamanho e adicionais\.?/gi,
    /escolha seus ingredientes(e)?\.?/gi,
    /qual a base do copo\??/gi,
    /escolha seus sabores(v)?\.?/gi,
    /toppings e adicionais\.?/gi,
    /se vai açaí puro,? sorvete ou casadinho\??/gi,
    /se vai acai puro,? sorvete ou casadinho\??/gi,
    /monte seu copo com os seus adicionais favoritos/gi,
  ];

  phrasesToRemove.forEach((regex) => {
    cleaned = cleaned.replace(regex, '');
  });

  // Clean up any double spaces, extra commas/periods, or trailing punctuation
  cleaned = cleaned.replace(/\s+/g, ' ');
  cleaned = cleaned.replace(/^\s*,\s*/g, '');
  cleaned = cleaned.trim();

  // If the entire description is cleaned out or empty, return a high-quality fallback
  if (!cleaned || cleaned.length < 5) {
    return 'O melhor preparado com ingredientes selecionados e de alta qualidade.';
  }

  // Capitalize first letter
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}
