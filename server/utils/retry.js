/**
 * Classifica se um erro da Gemini API pode ser retentado.
 * Erros de auth e quota são falhas definitivas — não há benefício em tentar novamente.
 * @param {unknown} error
 * @returns {boolean}
 */
export function isRetryable(error) {
  return error?.errorType !== 'auth' && error?.errorType !== 'quota';
}
