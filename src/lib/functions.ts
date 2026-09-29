import { FunctionsHttpError } from '@supabase/supabase-js';

const CONNECTION_ERROR = 'Error de conexión. Intentá nuevamente.';

/**
 * Mensaje de error de un `supabase.functions.invoke`, o null si salió bien.
 * Las Edge Functions responden { error } con status 400/401: en ese caso
 * supabase-js devuelve data = null y el cuerpo queda en error.context (la
 * Response), así que hay que leerlo de ahí para mostrar el motivo real en
 * vez de un "Error de conexión" genérico.
 */
export async function functionErrorMessage(data: unknown, error: unknown): Promise<string | null> {
  const dataError = (data as { error?: string } | null)?.error;
  if (dataError) return dataError;
  if (!error) return null;
  if (error instanceof FunctionsHttpError) {
    try {
      const body = (await error.context.json()) as { error?: string } | null;
      if (body?.error) return body.error;
    } catch {
      // cuerpo vacío o no-JSON: cae al mensaje genérico
    }
  }
  return CONNECTION_ERROR;
}
