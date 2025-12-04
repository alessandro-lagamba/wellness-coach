# Shared Components

## SafeAreaWrapper

Componente wrapper per `SafeAreaView` che gestisce automaticamente gli insets bottom per i tasti di navigazione Android.

### Utilizzo

```tsx
import { SafeAreaWrapper } from './shared/SafeAreaWrapper';

// Invece di:
<SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
  {children}
</SafeAreaView>

// Usa:
<SafeAreaWrapper style={styles.container}>
  {children}
</SafeAreaWrapper>
```

### Comportamento

- **Android**: Include automaticamente `'bottom'` negli edges per rispettare i tasti di navigazione
- **iOS**: Include solo `'top'`, `'left'`, `'right'` (il bottom è gestito automaticamente se necessario)

### Vantaggi

- ✅ Gestione automatica degli insets bottom su Android
- ✅ Compatibilità cross-platform
- ✅ API più semplice (non serve specificare gli edges manualmente)
- ✅ Consistenza in tutta l'app



