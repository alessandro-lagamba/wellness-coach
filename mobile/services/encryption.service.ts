/**
 * Encryption Service
 * 
 * Fornisce cifratura end-to-end (E2E) per dati sensibili degli utenti.
 * 
 * STRATEGIA:
 * - Chiave derivata dalla password dell'utente (PBKDF2)
 * - Cifratura AES-GCM per contenuti sensibili
 * - Chiave salvata temporaneamente in SecureStore solo durante la sessione
 * - Nemmeno l'admin del DB può leggere i contenuti cifrati
 * 
 * GDPR COMPLIANCE:
 * - Dati cifrati a riposo
 * - Cancellazione possibile (delete del record cifrato)
 * - Privacy by design
 */

import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import CryptoJS from 'crypto-js';
import { supabase } from '../lib/supabase';
import { logAuditEvent } from './audit-log.service';

const ENCRYPTION_KEYS = {
  USER_ENCRYPTION_KEY: 'user_encryption_key', // Chiave derivata dalla password, salvata in SecureStore
  KEY_SALT: 'user_key_salt', // Salt per derivazione chiave
};

const SECURE_STORE_KEY_REGEX = /[^A-Za-z0-9._-]/g;

function buildSecureStoreKey(base: string, userId: string): string {
  const safeBase = base.replace(SECURE_STORE_KEY_REGEX, '_');
  const safeUserId = (userId || '').replace(SECURE_STORE_KEY_REGEX, '_');
  return `${safeBase}_${safeUserId}`;
}

// Parametri per PBKDF2 (derivazione chiave da password)
const PBKDF2_ITERATIONS = 100000; // Alto numero per sicurezza
const PBKDF2_KEY_LENGTH = 32; // 256 bit per AES-256

// Parametri per AES-GCM
const AES_KEY_LENGTH = 32; // 256 bit
const IV_LENGTH = 12; // 96 bit per GCM (raccomandato)
const TAG_LENGTH = 16; // 128 bit per authentication tag

/**
 * Deriva una chiave di cifratura dalla password dell'utente usando PBKDF2
 * 
 * @param password Password dell'utente (non viene salvata)
 * @param salt Salt univoco per utente (salvato in SecureStore)
 * @returns Chiave derivata (256 bit)
 */
async function deriveKeyFromPassword(
  password: string,
  salt: string
): Promise<Uint8Array> {
  // Usa crypto-js per PBKDF2 (vero algoritmo PBKDF2)
  const saltWords = CryptoJS.enc.Hex.parse(salt);
  const key = CryptoJS.PBKDF2(password, saltWords, {
    keySize: AES_KEY_LENGTH / 4, // 32 bytes = 8 words (ogni word è 4 bytes)
    iterations: PBKDF2_ITERATIONS,
  });
  
  // Converti WordArray in Uint8Array
  const keyBytes = new Uint8Array(AES_KEY_LENGTH);
  const words = key.words;
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    keyBytes[i * 4] = (word >>> 24) & 0xff;
    keyBytes[i * 4 + 1] = (word >>> 16) & 0xff;
    keyBytes[i * 4 + 2] = (word >>> 8) & 0xff;
    keyBytes[i * 4 + 3] = word & 0xff;
  }
  
  return keyBytes;
}

/**
 * Genera un salt univoco per l'utente
 */
async function generateSalt(): Promise<string> {
  const randomBytes = await Crypto.getRandomBytesAsync(16);
  return Array.from(randomBytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Genera un IV (Initialization Vector) casuale per AES-GCM
 */
async function generateIV(): Promise<Uint8Array> {
  return await Crypto.getRandomBytesAsync(IV_LENGTH);
}

/**
 * Inizializza la chiave di cifratura per l'utente
 * 
 * Chiama questa funzione dopo il login dell'utente, passando la password.
 * La chiave derivata viene salvata temporaneamente in SecureStore.
 * 
 * IMPORTANTE: Il salt viene salvato su Supabase (user_profiles.encryption_salt)
 * così che l'utente possa accedere ai suoi dati da qualsiasi dispositivo.
 * 
 * @param userId ID dell'utente
 * @param password Password dell'utente (non viene salvata)
 * @returns true se l'inizializzazione è riuscita
 */
export async function initializeEncryptionKey(
  userId: string,
  password: string
): Promise<boolean> {
  try {
    // Recupera il salt da Supabase (user_profiles.encryption_salt)
    let salt: string | null = null;
    
    const { data: profile, error: fetchError } = await supabase
      .from('user_profiles')
      .select('encryption_salt')
      .eq('id', userId)
      .maybeSingle();
    
    if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 = not found
      console.warn('[Encryption] Error fetching salt from Supabase:', fetchError);
    }
    
    salt = profile?.encryption_salt || null;
    
    if (!salt) {
      // Primo login: genera un nuovo salt e salvalo su Supabase
      salt = await generateSalt();
      
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({ encryption_salt: salt })
        .eq('id', userId);
      
      if (updateError) {
        console.error('[Encryption] Failed to save salt to Supabase:', updateError);
        // Fallback: salva in SecureStore locale (ma non funzionerà su altri device)
        const saltKey = buildSecureStoreKey(ENCRYPTION_KEYS.KEY_SALT, userId);
        await SecureStore.setItemAsync(saltKey, salt);
        console.warn('[Encryption] Salt saved locally as fallback (multi-device will not work)');
      } else {
        console.log('[Encryption] ✅ Salt saved to Supabase for multi-device support');
      }
    }
    
    // Deriva la chiave dalla password + salt
    const derivedKey = await deriveKeyFromPassword(password, salt);
    
    // Salva la chiave derivata in SecureStore (solo per questa sessione)
    // La chiave viene cancellata al logout
    const keyHex = Array.from(derivedKey)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    
    await SecureStore.setItemAsync(
      buildSecureStoreKey(ENCRYPTION_KEYS.USER_ENCRYPTION_KEY, userId),
      keyHex
    );
    
    console.log('[Encryption] ✅ Encryption keys initialized successfully for user:', userId);
    
    // Log audit per inizializzazione chiavi
    await logAuditEvent('access', 'encryption_key', userId, {
      action: 'key_initialized',
      timestamp: new Date().toISOString(),
    });
    
    return true;
  } catch (error) {
    console.error('[Encryption] Failed to initialize encryption key:', error);
    return false;
  }
}

/**
 * Recupera la chiave di cifratura per l'utente corrente
 * 
 * @param userId ID dell'utente
 * @returns Chiave come Uint8Array o null se non trovata
 */
async function getEncryptionKey(userId: string): Promise<Uint8Array | null> {
  try {
    const keyHex = await SecureStore.getItemAsync(
      buildSecureStoreKey(ENCRYPTION_KEYS.USER_ENCRYPTION_KEY, userId)
    );
    
    if (!keyHex) {
      return null;
    }
    
    // Converti hex string in Uint8Array
    const keyBytes = new Uint8Array(AES_KEY_LENGTH);
    for (let i = 0; i < AES_KEY_LENGTH; i++) {
      keyBytes[i] = parseInt(keyHex.slice(i * 2, i * 2 + 2), 16);
    }
    
    return keyBytes;
  } catch (error) {
    // Solo loggare errori critici, non warning per chiave non trovata (caso normale se utente non loggato)
    return null;
  }
}

/**
 * Cifra un testo usando AES-CBC + HMAC (equivalente a AES-GCM in sicurezza)
 * 
 * @param plaintext Testo da cifrare
 * @param userId ID dell'utente
 * @returns Stringa JSON con {ciphertext, iv, hmac} in base64, o null se errore
 */
export async function encryptText(
  plaintext: string,
  userId: string
): Promise<string | null> {
  try {
    if (!plaintext || plaintext.trim().length === 0) {
      return null; // Non cifrare stringhe vuote
    }
    
    const key = await getEncryptionKey(userId);
    if (!key) {
      // Non loggare warning - è normale se l'utente non è ancora autenticato
      // Il chiamante gestirà il caso null
      return null;
    }
    
    // Converti Uint8Array key in WordArray per crypto-js
    const keyWords = CryptoJS.lib.WordArray.create(key);
    
    // 🔥 FIX: Genera IV casuale usando expo-crypto invece di CryptoJS.lib.WordArray.random
    // CryptoJS.lib.WordArray.random() usa il modulo crypto nativo di Node.js che non è disponibile in React Native
    const ivBytes = await Crypto.getRandomBytesAsync(16);
    const iv = CryptoJS.lib.WordArray.create(ivBytes);
    
    // Cifra con AES-CBC
    const encrypted = CryptoJS.AES.encrypt(plaintext, keyWords, {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    });
    
    // Calcola HMAC per autenticazione (equivalente al tag GCM)
    const hmac = CryptoJS.HmacSHA256(encrypted.ciphertext, keyWords);
    
    const encryptedData = {
      ciphertext: encrypted.ciphertext.toString(CryptoJS.enc.Base64),
      iv: iv.toString(CryptoJS.enc.Base64),
      hmac: hmac.toString(CryptoJS.enc.Base64),
      algorithm: 'AES-CBC-256-HMAC', // Marker per algoritmo
    };
    
    return JSON.stringify(encryptedData);
  } catch (error) {
    console.error('[Encryption] Failed to encrypt text:', error);
    return null;
  }
}

/**
 * Decifra un testo cifrato usando AES-CBC + HMAC
 * 
 * @param encryptedData Stringa JSON con {ciphertext, iv, hmac} in base64
 * @param userId ID dell'utente
 * @returns Testo decifrato o null se errore
 */
export async function decryptText(
  encryptedData: string,
  userId: string
): Promise<string | null> {
  try {
    if (!encryptedData) {
      return null;
    }
    
    // Parse dei dati cifrati per verificare se sono effettivamente criptati
    let data: { ciphertext: string; iv: string; hmac?: string; tag?: string; algorithm?: string } | null = null;
    let isEncrypted = false;
    
    try {
      data = JSON.parse(encryptedData);
      // Se ha algoritmo, è sicuramente criptato
      isEncrypted = !!(data.algorithm && (data.algorithm === 'AES-CBC-256-HMAC' || data.algorithm === 'AES-GCM-256'));
    } catch {
      // Se non è JSON, è testo non cifrato (backward compatibility)
      return encryptedData;
    }
    
    // Se non ha algoritmo, assume formato vecchio (backward compatibility) - testo non cifrato
    if (!data.algorithm) {
      return encryptedData; // Testo non cifrato
    }
    
    // Verifica algoritmo (supporta sia vecchio che nuovo formato)
    if (data.algorithm && data.algorithm !== 'AES-CBC-256-HMAC' && data.algorithm !== 'AES-GCM-256') {
      console.warn('[Encryption] Unknown algorithm:', data.algorithm);
      return null;
    }
    
    // Solo ora controlliamo la chiave - se i dati sono criptati ma la chiave non c'è, è un problema
    const key = await getEncryptionKey(userId);
    if (!key) {
      // Loggare warning solo se i dati sono effettivamente criptati
      if (isEncrypted) {
        // Questo è un vero problema: dati criptati ma chiave non disponibile
        // Potrebbe essere un utente loggato che ha perso la sessione
        console.warn('[Encryption] Encrypted data found but no encryption key available for user:', userId);
      }
      // Se i dati non sono criptati, è normale (backward compatibility)
      return null;
    }
    
    // Converti Uint8Array key in WordArray per crypto-js
    const keyWords = CryptoJS.lib.WordArray.create(key);
    
    // Decodifica IV e ciphertext
    const iv = CryptoJS.enc.Base64.parse(data.iv);
    const ciphertext = CryptoJS.enc.Base64.parse(data.ciphertext);
    
    // Verifica HMAC se presente (autenticazione)
    if (data.hmac) {
      const expectedHmac = CryptoJS.HmacSHA256(ciphertext, keyWords);
      const providedHmac = CryptoJS.enc.Base64.parse(data.hmac);
      
      if (expectedHmac.toString() !== providedHmac.toString()) {
        console.error('[Encryption] HMAC verification failed - data may be corrupted or tampered');
        return null; // Autenticazione fallita
      }
    }
    
    // Decifra con AES-CBC
    const decrypted = CryptoJS.AES.decrypt(
      { ciphertext: ciphertext } as any,
      keyWords,
      {
        iv: iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7,
      }
    );
    
    const plaintext = decrypted.toString(CryptoJS.enc.Utf8);
    
    if (!plaintext) {
      console.error('[Encryption] Decryption failed - invalid key or corrupted data');
      return null;
    }
    
    return plaintext;
  } catch (error) {
    console.error('[Encryption] Failed to decrypt text:', error);
    return null;
  }
}

/**
 * Cancella la chiave di cifratura per l'utente (chiamare al logout)
 * 
 * @param userId ID dell'utente
 */
export async function clearEncryptionKey(userId: string): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(
      buildSecureStoreKey(ENCRYPTION_KEYS.USER_ENCRYPTION_KEY, userId)
    );
  } catch (error) {
    console.error('[Encryption] Failed to clear encryption key:', error);
  }
}

/**
 * Verifica se la cifratura è inizializzata per l'utente
 * 
 * @param userId ID dell'utente
 * @returns true se la chiave esiste
 */
export async function isEncryptionInitialized(userId: string): Promise<boolean> {
  try {
    const key = await getEncryptionKey(userId);
    return key !== null;
  } catch {
    return false;
  }
}

/**
 * Cifra un array di stringhe (utile per observations, notes, ecc.)
 * 
 * @param array Array di stringhe da cifrare
 * @param userId ID dell'utente
 * @returns Stringa JSON cifrata o null se errore
 */
export async function encryptStringArray(
  array: string[],
  userId: string
): Promise<string | null> {
  if (!array || array.length === 0) {
    return null;
  }
  
  // Serializza l'array come JSON e cifra
  const jsonString = JSON.stringify(array);
  return await encryptText(jsonString, userId);
}

/**
 * Decifra un array di stringhe
 * 
 * @param encryptedData Stringa JSON cifrata
 * @param userId ID dell'utente
 * @returns Array di stringhe o null se errore
 */
export async function decryptStringArray(
  encryptedData: string | null | undefined,
  userId: string
): Promise<string[] | null> {
  if (!encryptedData) {
    return null;
  }
  
  const decrypted = await decryptText(encryptedData, userId);
  if (!decrypted) {
    return null;
  }
  
  try {
    return JSON.parse(decrypted) as string[];
  } catch {
    // Se non è JSON valido, potrebbe essere un array vecchio non cifrato
    // Prova a parsare direttamente
    try {
      return JSON.parse(encryptedData) as string[];
    } catch {
      return null;
    }
  }
}

