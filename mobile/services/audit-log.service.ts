/**
 * Audit Log Service
 * 
 * Registra gli accessi ai dati sensibili per compliance e sicurezza.
 * Traccia: letture, scritture, decifrature, cifrature di dati personali.
 */

import { supabase } from '../lib/supabase';
import { AuthService } from './auth.service';

export type AuditAction = 'read' | 'write' | 'delete' | 'decrypt' | 'encrypt' | 'access';
export type AuditResourceType =
  | 'journal'
  | 'chat'
  | 'food_analysis'
  | 'recipe'
  | 'fridge_item'
  | 'meal_plan'
  | 'checkin'
  | 'detailed_analysis'
  | 'encryption_key';

interface AuditLogMetadata {
  [key: string]: any;
}

/**
 * Registra un evento di audit
 * 
 * @param action Azione eseguita (read, write, delete, decrypt, encrypt)
 * @param resourceType Tipo di risorsa (journal, chat, etc.)
 * @param resourceId ID della risorsa (opzionale)
 * @param metadata Metadati aggiuntivi (opzionale)
 */
export async function logAuditEvent(
  action: AuditAction,
  resourceType: AuditResourceType,
  resourceId?: string,
  metadata?: AuditLogMetadata
): Promise<void> {
  try {
    const user = await AuthService.getCurrentUser();
    if (!user) {
      // Non loggare se l'utente non è autenticato (evita spam)
      return;
    }

    // Non bloccare il flusso principale se l'audit fallisce
    // Usa un fire-and-forget pattern
    supabase
      .from('audit_logs')
      .insert({
        user_id: user.id,
        action,
        resource_type: resourceType,
        resource_id: resourceId || null,
        metadata: metadata || {},
      })
      .then(() => {
        // Log silenzioso in sviluppo
        if (__DEV__) {
          console.log(`[Audit] ${action} on ${resourceType}${resourceId ? ` (${resourceId})` : ''}`);
        }
      })
      .catch((error) => {
        // Non bloccare il flusso, solo loggare l'errore
        console.warn('[Audit] Failed to log event:', error);
      });
  } catch (error) {
    // Non bloccare mai il flusso principale per errori di audit
    console.warn('[Audit] Error in logAuditEvent:', error);
  }
}

/**
 * Helper per loggare accessi a dati cifrati
 */
export async function logDecryptionEvent(
  resourceType: AuditResourceType,
  resourceId?: string
): Promise<void> {
  await logAuditEvent('decrypt', resourceType, resourceId, {
    timestamp: new Date().toISOString(),
  });
}

/**
 * Helper per loggare cifrature di dati
 */
export async function logEncryptionEvent(
  resourceType: AuditResourceType,
  resourceId?: string
): Promise<void> {
  await logAuditEvent('encrypt', resourceType, resourceId, {
    timestamp: new Date().toISOString(),
  });
}

/**
 * Helper per loggare letture di dati sensibili
 */
export async function logReadEvent(
  resourceType: AuditResourceType,
  resourceId?: string
): Promise<void> {
  await logAuditEvent('read', resourceType, resourceId);
}

/**
 * Helper per loggare scritture di dati sensibili
 */
export async function logWriteEvent(
  resourceType: AuditResourceType,
  resourceId?: string
): Promise<void> {
  await logAuditEvent('write', resourceType, resourceId);
}


