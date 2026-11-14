// Gera um trecho aleatório imprevisível para IDs de pedido (evita que alguém adivinhe pedidos de outros clientes).
export function secureRandomHex(bytes = 12): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
}
