/**
 * 🧪 NOTIFICATION TESTING UTILITIES
 * 
 * Aggiungi questo file temporaneamente per testare le notifiche.
 * Puoi importare queste funzioni in HomeScreen o in un componente di debug.
 * 
 * ⚠️ RICORDA: Le notifiche funzionano SOLO su dispositivo reale, non su simulatore!
 */

import * as Notifications from 'expo-notifications';
import { NotificationService } from './notifications.service';
import AsyncStorage from '@react-native-async-storage/async-storage';
import PushNotificationService from './push-notification.service';
import { AuthService } from './auth.service';

/**
 * 📋 Test #1: Visualizza tutte le notifiche schedulate
 * 
 * Usa questo per verificare:
 * - Quante notifiche sono schedulate
 * - Se ci sono duplicazioni
 * - Gli orari delle notifiche
 */
export const debugScheduledNotifications = async () => {
    const all = await Notifications.getAllScheduledNotificationsAsync();

    console.log('\n📅 ========== NOTIFICHE SCHEDULATE ==========');
    console.log(`Totale: ${all.length} notifiche\n`);

    // Raggruppa per categoria
    const byCategory = all.reduce((acc, n) => {
        const category = n.content.data?.category || 'unknown';
        if (!acc[category]) acc[category] = [];
        acc[category].push(n);
        return acc;
    }, {} as Record<string, any[]>);

    // Stampa riepilogo per categoria
    Object.entries(byCategory).forEach(([category, notifs]) => {
        console.log(`\n📌 ${category.toUpperCase()}: ${notifs.length} notifiche`);
        notifs.forEach((n, index) => {
            const key = n.content.data?.key;
            const trigger = n.trigger as any;
            const title = n.content.title;

            console.log(`  ${index + 1}. "${title}"`);
            console.log(`     ID: ${n.identifier}`);
            console.log(`     Key: ${key}`);

            if (trigger?.hour !== undefined) {
                const hour = String(trigger.hour).padStart(2, '0');
                const minute = String(trigger.minute).padStart(2, '0');
                console.log(`     Orario: ${hour}:${minute}`);
                if (trigger.weekday) {
                    const days = ['', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
                    console.log(`     Giorno: ${days[trigger.weekday]}`);
                }
                console.log(`     Ripete: ${trigger.repeats ? 'Sì' : 'No'}`);
            } else if (trigger?.seconds) {
                console.log(`     Tra: ${trigger.seconds} secondi`);
            }
        });
    });

    // Verifica duplicazioni
    console.log('\n🔍 ========== VERIFICA DUPLICAZIONI ==========');
    const keys = all.map(n => n.content.data?.key).filter(Boolean);
    const keyCount = keys.reduce((acc, key) => {
        acc[key] = (acc[key] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    const duplicates = Object.entries(keyCount).filter(([_, count]) => count > 1);

    if (duplicates.length > 0) {
        console.warn('⚠️ DUPLICAZIONI TROVATE:');
        duplicates.forEach(([key, count]) => {
            console.warn(`  - ${key}: ${count} volte`);
        });
    } else {
        console.log('✅ Nessuna duplicazione trovata');
    }

    console.log('\n============================================\n');

    return {
        total: all.length,
        byCategory,
        duplicates: duplicates.length > 0 ? duplicates : null,
    };
};

/**
 * 🧪 Test #2: Invia notifica di test immediata
 * 
 * Usa questo per testare rapidamente se le notifiche funzionano
 */
export const sendTestNotification = async (delaySeconds: number = 5) => {
    await NotificationService.schedule(
        'test_notification',
        '🧪 Test Notifica',
        `Questa è una notifica di test! Dovrebbe arrivare tra ${delaySeconds} secondi.`,
        { secondsFromNow: delaySeconds },
        { screen: 'home' }
    );

    console.log(`✅ Notifica di test schedulata per tra ${delaySeconds} secondi`);
    console.log('📱 Controlla il tuo dispositivo!');
};

/**
 * 🔄 Test #3: Reset completo notifiche
 * 
 * Usa questo per cancellare tutte le notifiche e ri-schedulare
 */
export const resetAllNotifications = async () => {
    console.log('\n🔄 ========== RESET NOTIFICHE ==========');

    // 1. Cancella tutte
    console.log('1️⃣ Cancellazione notifiche...');
    await NotificationService.cancelAll();

    const afterCancel = await Notifications.getAllScheduledNotificationsAsync();
    console.log(`   ✅ Cancellate. Rimaste: ${afterCancel.length}`);

    // 2. Ri-schedula
    console.log('2️⃣ Ri-scheduling notifiche...');
    await NotificationService.scheduleDefaults();

    const afterSchedule = await Notifications.getAllScheduledNotificationsAsync();
    console.log(`   ✅ Schedulate. Totale: ${afterSchedule.length}`);

    console.log('\n======================================\n');

    return afterSchedule.length;
};

/**
 * 📊 Test #4: Riepilogo notifiche per orario
 * 
 * Mostra tutte le notifiche ordinate per orario
 */
export const showNotificationSchedule = async () => {
    const all = await Notifications.getAllScheduledNotificationsAsync();

    console.log('\n📊 ========== PROGRAMMA NOTIFICHE ==========\n');

    // Filtra solo notifiche con orario
    const timed = all
        .filter(n => (n.trigger as any)?.hour !== undefined)
        .map(n => {
            const trigger = n.trigger as any;
            const hour = trigger.hour;
            const minute = trigger.minute;
            const weekday = trigger.weekday;
            const title = n.content.title;
            const category = n.content.data?.category;

            return { hour, minute, weekday, title, category };
        })
        .sort((a, b) => {
            // Ordina per orario
            if (a.hour !== b.hour) return a.hour - b.hour;
            return a.minute - b.minute;
        });

    // Raggruppa per orario
    const byTime = timed.reduce((acc, n) => {
        const time = `${String(n.hour).padStart(2, '0')}:${String(n.minute).padStart(2, '0')}`;
        if (!acc[time]) acc[time] = [];
        acc[time].push(n);
        return acc;
    }, {} as Record<string, typeof timed>);

    // Stampa
    Object.entries(byTime).forEach(([time, notifs]) => {
        console.log(`⏰ ${time}`);
        notifs.forEach(n => {
            const days = n.weekday
                ? ` (${['', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'][n.weekday]})`
                : ' (Ogni giorno)';
            console.log(`   - ${n.title}${days}`);
        });
        console.log('');
    });

    console.log('==========================================\n');
};

/**
 * 🧪 Test #5: Testa mood decline notification
 */
export const testMoodDeclineNotification = async () => {
    console.log('\n😔 ========== TEST MOOD DECLINE ==========');

    const user = await AuthService.getCurrentUser();
    if (!user) {
        console.error('❌ Utente non autenticato');
        return;
    }

    const pushService = PushNotificationService.getInstance();

    // Abilita push notifications
    await pushService.setEnabled(true);
    await pushService.initialize(user.id);

    console.log('🔍 Controllo mood decline...');

    // Controlla regole
    await pushService.checkAllRules(user.id);

    console.log('✅ Controllo completato');
    console.log('📱 Se hai 3 analisi emotive consecutive con valence in calo, riceverai una notifica');
    console.log('=========================================\n');
};

/**
 * 🎯 Test #6: Testa notifica con orario specifico (tra X minuti)
 * 
 * Utile per testare notifiche giornaliere senza aspettare
 */
export const scheduleTestNotificationInMinutes = async (minutes: number = 2) => {
    const now = new Date();
    const testTime = new Date(now.getTime() + minutes * 60 * 1000);
    const testHour = testTime.getHours();
    const testMinute = testTime.getMinutes();

    await NotificationService.schedule(
        'test_timed_notification',
        '🧪 Test Notifica Programmata',
        `Questa notifica dovrebbe arrivare alle ${String(testHour).padStart(2, '0')}:${String(testMinute).padStart(2, '0')}`,
        { hour: testHour, minute: testMinute, repeats: false },
        { screen: 'home' }
    );

    console.log(`✅ Notifica programmata per ${String(testHour).padStart(2, '0')}:${String(testMinute).padStart(2, '0')} (tra ${minutes} minuti)`);
    console.log('📱 Controlla il tuo dispositivo!');
};

/**
 * 🔍 Test #7: Verifica permessi notifiche
 */
export const checkNotificationPermissions = async () => {
    console.log('\n🔐 ========== PERMESSI NOTIFICHE ==========');

    const settings = await Notifications.getPermissionsAsync();

    console.log('Status:', settings.status);
    console.log('Granted:', settings.granted);
    console.log('Can ask again:', settings.canAskAgain);

    if (settings.ios) {
        console.log('\niOS Settings:');
        console.log('  Status:', settings.ios.status);
        console.log('  Alert:', settings.ios.allowsAlert);
        console.log('  Badge:', settings.ios.allowsBadge);
        console.log('  Sound:', settings.ios.allowsSound);
    }

    if (settings.android) {
        console.log('\nAndroid Settings:');
        console.log('  Importance:', settings.android.importance);
    }

    if (!settings.granted) {
        console.warn('\n⚠️ PERMESSI NON CONCESSI!');
        console.log('Richiesta permessi...');
        const request = await Notifications.requestPermissionsAsync();
        console.log('Risultato:', request.granted ? '✅ Concessi' : '❌ Negati');
    } else {
        console.log('\n✅ Permessi concessi');
    }

    console.log('=========================================\n');

    return settings;
};

/**
 * 📦 Test Suite Completo
 * 
 * Esegue tutti i test in sequenza
 */
export const runFullTestSuite = async () => {
    console.log('\n🧪 ========== TEST SUITE NOTIFICHE ==========\n');

    // 1. Verifica permessi
    console.log('1️⃣ Verifica permessi...');
    await checkNotificationPermissions();

    // 2. Mostra notifiche schedulate
    console.log('2️⃣ Notifiche schedulate...');
    await debugScheduledNotifications();

    // 3. Mostra programma
    console.log('3️⃣ Programma notifiche...');
    await showNotificationSchedule();

    // 4. Invia test
    console.log('4️⃣ Invio notifica di test...');
    await sendTestNotification(10);

    console.log('\n✅ Test suite completato!');
    console.log('📱 Controlla il tuo dispositivo per la notifica di test tra 10 secondi\n');
    console.log('============================================\n');
};

// Export default per import semplice
export default {
    debugScheduledNotifications,
    sendTestNotification,
    resetAllNotifications,
    showNotificationSchedule,
    testMoodDeclineNotification,
    scheduleTestNotificationInMinutes,
    checkNotificationPermissions,
    runFullTestSuite,
};
