/**
 * Environment Variables Validator
 * Valida variabili d'ambiente critiche all'avvio
 */

interface EnvValidationResult {
  isValid: boolean;
  missing: string[];
  warnings: string[];
}

export function validateEnvironment(): EnvValidationResult {
  const missing: string[] = [];
  const warnings: string[] = [];

  // Variabili critiche (crashano se mancanti)
  const criticalVars = [
    'OPENAI_API_KEY', // Usato in più servizi
    'REPLICATE_API_TOKEN', // Usato per generazione avatar
  ];

  // Variabili importanti (funzionalità limitate se mancanti)
  const importantVars = [
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
  ];

  // Variabili opzionali (warning se mancanti)
  const optionalVars = [
    'CARTESIA_API_KEY',
    'DEEPGRAM_API_KEY',
    'LIVEKIT_API_KEY',
    'LIVEKIT_API_SECRET',
    'SUPABASE_AVATAR_BUCKET',
  ];

  // Verifica critiche
  for (const varName of criticalVars) {
    if (!process.env[varName] || process.env[varName]!.trim() === '') {
      missing.push(varName);
    }
  }

  // Verifica importanti
  for (const varName of importantVars) {
    if (!process.env[varName] || process.env[varName]!.trim() === '') {
      warnings.push(varName);
    }
  }

  // Verifica opzionali (solo warning)
  for (const varName of optionalVars) {
    if (!process.env[varName] || process.env[varName]!.trim() === '') {
      warnings.push(varName);
    }
  }

  return {
    isValid: missing.length === 0,
    missing,
    warnings,
  };
}

export function validateAndExit(): void {
  const result = validateEnvironment();

  if (result.missing.length > 0) {
    console.error('❌ CRITICAL: Missing required environment variables:');
    result.missing.forEach(v => console.error(`   - ${v}`));
    console.error('\n⚠️  Server cannot start without these variables.');
    console.error('💡 Set them using: fly secrets set VARIABLE_NAME=value');
    process.exit(1);
  }

  if (result.warnings.length > 0) {
    console.warn('⚠️  WARNING: Missing optional environment variables:');
    result.warnings.forEach(v => console.warn(`   - ${v}`));
    console.warn('   Some features may be limited.\n');
  }

  console.log('✅ Environment variables validated successfully');
}



