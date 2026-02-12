import { Footer } from '../../components/Footer';

export default function PrivacyPage() {
    return (
        <div className="min-h-screen bg-gray-950 text-gray-200 font-sans selection:bg-purple-500/30">
            <div className="max-w-4xl mx-auto px-6 py-12 md:py-20">
                <h1 className="text-3xl md:text-5xl font-bold text-white mb-2">Informativa Privacy</h1>
                <p className="text-purple-400 font-medium mb-8">Art. 13-14 GDPR</p>

                <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg p-6 mb-12">
                    <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                        ⚠️ VERSIONE BETA TEST
                    </h2>
                    <div className="text-sm space-y-1 text-gray-300">
                        <p><strong>Versione:</strong> 1.0 Beta</p>
                        <p><strong>Data di efficacia:</strong> 11/02/2026</p>
                        <p><strong>Ultima modifica:</strong> 11/02/2026</p>
                    </div>
                    <p className="mt-4 text-sm leading-relaxed">
                        <strong>ATTENZIONE:</strong> Questa informativa è valida per la <strong>fase di beta testing</strong> dell'applicazione Yachai, distribuita tramite il sito web www.yachai.net esclusivamente a utenti selezionati per testare l'applicazione. Prima della pubblicazione sugli store ufficiali (Apple App Store e Google Play Store), questa informativa verrà aggiornata e revisionata.
                    </p>
                </div>

                <div className="space-y-12 text-gray-300 leading-relaxed">
                    <section>
                        <h2 className="text-2xl font-bold text-white mb-4">1. Titolare del Trattamento e Contatti</h2>
                        <p className="mb-4">Il Titolare del trattamento dei dati personali è:</p>
                        <div className="bg-gray-900/50 p-6 rounded-lg border border-gray-800">
                            <p className="font-bold text-white text-lg mb-2">LaBella&Partners S.R.L.</p>
                            <ul className="space-y-2 text-sm">
                                <li>Sede legale: Via del Giuba 9, 00199 Roma</li>
                                <li>Partita IVA: 01470311000</li>
                                <li>PEC: <a href="mailto:astersrl@gigapec.it" className="text-purple-400 hover:underline">astersrl@gigapec.it</a></li>
                                <li>Email privacy: <a href="mailto:customer.service@labellapartners.com" className="text-purple-400 hover:underline">customer.service@labellapartners.com</a></li>
                            </ul>
                        </div>
                        <p className="mt-4 text-sm">
                            <strong>Data Protection Officer (DPO):</strong> Non nominato (motivazione: il trattamento non rientra nelle casistiche obbligatorie ex art. 37 GDPR; in ogni caso, per esercitare i diritti o per informazioni sul trattamento è possibile contattare il Titolare ai recapiti sopra indicati).
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-white mb-4">2. Categorie di Dati Personali Trattati</h2>
                        <p className="mb-4">Nell'ambito dell'utilizzo dell'app Yachai, trattiamo le seguenti categorie di dati personali:</p>

                        <div className="space-y-6">
                            <div>
                                <h3 className="text-xl font-semibold text-white mb-2">2.1 Dati Comuni</h3>
                                <ul className="list-disc pl-5 space-y-1 marker:text-purple-500">
                                    <li><strong>Dati identificativi:</strong> nome, cognome, email, ID utente univoco</li>
                                    <li><strong>Dati anagrafici:</strong> età o data di nascita (per age-gate e personalizzazione)</li>
                                    <li><strong>Dati di utilizzo:</strong> log di accesso, interazioni con l'app, preferenze, timestamp</li>
                                </ul>
                            </div>

                            <div>
                                <h3 className="text-xl font-semibold text-white mb-2">2.2 Dati Particolari (Art. 9 GDPR) – Dati Relativi alla Salute</h3>
                                <ul className="list-disc pl-5 space-y-1 marker:text-purple-500">
                                    <li><strong>Dati biometrici e fisiologici</strong> importati da Apple Health e Google Fit: peso, altezza, frequenza cardiaca, variabilità cardiaca (HRV), qualità del sonno, numero di passi</li>
                                    <li><strong>Dati derivati:</strong> parametri calcolati dall'app sulla base dei dati salute (es. indici di benessere, insight personalizzati)</li>
                                </ul>
                                <p className="mt-2 text-sm italic border-l-2 border-purple-500 pl-4 py-1 bg-purple-900/10">
                                    Nota importante: I dati relativi alla salute sono dati "particolari" ai sensi dell'art. 9 GDPR e beneficiano di maggiori tutele. Il loro trattamento avviene solo previo consenso esplicito e separato.
                                </p>
                            </div>

                            <div>
                                <h3 className="text-xl font-semibold text-white mb-2">2.3 Dati Generati dall'Uso di Funzioni AI</h3>
                                <ul className="list-disc pl-5 space-y-1 marker:text-purple-500">
                                    <li><strong>Contenuti di chat, diario testuale, immagini caricate:</strong> possono essere trasmessi a OpenAI per generare risposte o analisi, ma <strong>non vengono salvati in modo permanente</strong> nei nostri database.</li>
                                    <li><strong>Output AI:</strong> conservati solo se necessari per fornirti il servizio.</li>
                                </ul>
                            </div>

                            <div>
                                <h3 className="text-xl font-semibold text-white mb-2">2.4 Dati Tecnici e di Sicurezza</h3>
                                <ul className="list-disc pl-5 space-y-1 marker:text-purple-500">
                                    <li>Indirizzo IP, user-agent, modello dispositivo, versione OS, ID dispositivo</li>
                                    <li>Log tecnici e di sicurezza (accessi, errori, crash report via Sentry)</li>
                                    <li>Dati di analytics (Firebase Analytics)</li>
                                </ul>
                            </div>
                        </div>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-white mb-4">3. Finalità del Trattamento e Basi Giuridiche</h2>
                        <div className="overflow-x-auto border border-gray-800 rounded-lg">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-gray-900 text-gray-400 uppercase font-semibold border-b border-gray-800">
                                    <tr>
                                        <th className="px-6 py-3">Finalità</th>
                                        <th className="px-6 py-3">Base Giuridica</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-800">
                                    <tr>
                                        <td className="px-6 py-4">Erogazione del servizio e gestione account</td>
                                        <td className="px-6 py-4">Esecuzione contratto (art. 6.1.b)</td>
                                    </tr>
                                    <tr>
                                        <td className="px-6 py-4">Personalizzazione e raccomandazioni (profilazione)</td>
                                        <td className="px-6 py-4 text-purple-300">Consenso esplicito (art. 6.1.a + art. 9.2.a)</td>
                                    </tr>
                                    <tr>
                                        <td className="px-6 py-4">Funzioni AI</td>
                                        <td className="px-6 py-4 text-purple-300">Consenso esplicito (art. 9.2.a GDPR)</td>
                                    </tr>
                                    <tr>
                                        <td className="px-6 py-4">Analytics e miglioramento app</td>
                                        <td className="px-6 py-4">Legittimo interesse (art. 6.1.f)</td>
                                    </tr>
                                    <tr>
                                        <td className="px-6 py-4">Sicurezza e prevenzione frodi</td>
                                        <td className="px-6 py-4">Legittimo interesse (art. 6.1.f)</td>
                                    </tr>
                                    <tr>
                                        <td className="px-6 py-4">Adempimenti legali</td>
                                        <td className="px-6 py-4">Obbligo legale (art. 6.1.c)</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        <div className="mt-6">
                            <h3 className="text-xl font-semibold text-white mb-2">3.1 Profilazione e Decisioni Automatizzate</h3>
                            <p>L'app utilizza analisi automatizzata per generare raccomandazioni personalizzate. Non si tratta di decisioni con effetti legali o significativi. Hai diritto di opporti alla profilazione e di revocare il consenso in ogni momento.</p>
                        </div>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-white mb-4">4. Destinatari e Comunicazione dei Dati</h2>
                        <p className="mb-4">I tuoi dati possono essere trattati da fornitori terzi (Responsabili del Trattamento) che operano sotto nostre direttive:</p>
                        <ul className="list-disc pl-5 space-y-2 marker:text-purple-500 mb-6">
                            <li><strong>Supabase Inc.</strong>: Responsabile del trattamento (Database, Auth). Sede USA (garanzie SCC).</li>
                            <li><strong>Google LLC (Firebase)</strong>: Responsabile del trattamento (Analytics, Cloud). Sede USA (garanzie SCC).</li>
                            <li><strong>Sentry</strong>: Monitoraggio errori.</li>
                            <li><strong>OpenAI L.L.C.</strong>: Elaborazione richieste AI.</li>
                        </ul>

                        <div className="bg-gray-900/50 p-4 rounded-lg border-l-4 border-purple-500">
                            <h4 className="font-bold text-white mb-1">Nota su OpenAI</h4>
                            <p className="text-sm">I contenuti inviati alle funzioni AI possono essere trasmessi a OpenAI per l'elaborazione. OpenAI dichiara di non utilizzare i dati API per addestrare i modelli (salvo opt-in). I contenuti AI non vengono salvati permanentemente nei nostri database.</p>
                        </div>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-white mb-4">5. Trasferimenti Extra-UE</h2>
                        <p>Alcuni fornitori hanno sede negli USA. Adottiamo garanzie come le Standard Contractual Clauses (SCC) e misure tecniche supplementari per proteggere i tuoi dati secondo gli standard GDPR.</p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-white mb-4">6. Conservazione dei Dati (Retention)</h2>
                        <div className="space-y-4">
                            <div>
                                <h3 className="text-xl font-semibold text-white mb-2">6.1 Fase Beta</h3>
                                <p>Durante la beta, i dati personali (inclusi dati salute) sono conservati fino al termine del test e cancellati entro 30 giorni dalla fine della beta, salvo sottoscrizione di piano a pagamento.</p>
                            </div>
                            <div>
                                <h3 className="text-xl font-semibold text-white mb-2">6.2 Account Attivi</h3>
                                <p>Per gli account attivi, i dati sono conservati finché necessari per il servizio. In caso di cancellazione account, i dati vengono eliminati entro 60 giorni (salvo obblighi di legge).</p>
                            </div>
                        </div>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-white mb-4">7. Misure di Sicurezza</h2>
                        <p className="mb-4">Adottiamo misure tecniche avanzate per proteggere i dati salute:</p>
                        <ul className="list-disc pl-5 space-y-1 marker:text-purple-500">
                            <li>Cifratura in transito (TLS 1.2+) e a riposo (AES-256)</li>
                            <li>Controllo accessi e autenticazione a più fattori</li>
                            <li>Minimizzazione dei dati e pseudonimizzazione</li>
                            <li>Audit log e monitoraggio sicurezza</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-white mb-4">8. Diritti dell'Interessato</h2>
                        <p className="mb-4">Ai sensi del GDPR, hai il diritto di:</p>
                        <ul className="grid md:grid-cols-2 gap-4 text-sm">
                            <li className="bg-gray-900 p-3 rounded border border-gray-800">✅ <strong>Accesso:</strong> Ottenere conferma e copia dei dati.</li>
                            <li className="bg-gray-900 p-3 rounded border border-gray-800">✏️ <strong>Rettifica:</strong> Correggere dati inesatti.</li>
                            <li className="bg-gray-900 p-3 rounded border border-gray-800">🗑️ <strong>Cancellazione:</strong> Diritto all'oblio.</li>
                            <li className="bg-gray-900 p-3 rounded border border-gray-800">⏹️ <strong>Limitazione:</strong> Limitare il trattamento.</li>
                            <li className="bg-gray-900 p-3 rounded border border-gray-800">📦 <strong>Portabilità:</strong> Ricevere i dati in formato strutturato.</li>
                            <li className="bg-gray-900 p-3 rounded border border-gray-800">🚫 <strong>Opposizione:</strong> Opporti al trattamento.</li>
                        </ul>
                        <p className="mt-4 text-sm">Per esercitare i tuoi diritti, scrivi a: <a href="mailto:customer.service@labellapartners.com" className="text-purple-400 hover:underline">customer.service@labellapartners.com</a></p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-white mb-4">9. Utenti Minorenni</h2>
                        <div className="bg-red-900/20 border border-red-500/30 p-4 rounded-lg">
                            <p className="font-bold text-red-200 mb-2">Età Minima: 16 Anni</p>
                            <p className="text-sm">Durante la fase Beta Test, l'applicazione è riservata esclusivamente a utenti di almeno 16 anni. Non è consentita la registrazione a utenti di età inferiore.</p>
                        </div>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-white mb-4">12. Contatti</h2>
                        <p className="mb-2">Per qualsiasi richiesta sulla privacy:</p>
                        <address className="not-italic bg-gray-900 p-4 rounded border border-gray-800">
                            <strong>LaBella&Partners S.R.L.</strong><br />
                            Via del Giuba 9, 00199 Roma<br />
                            Email: <a href="mailto:customer.service@labellapartners.com" className="text-purple-400">customer.service@labellapartners.com</a>
                        </address>
                    </section>
                </div>

            </div>
            <Footer />
        </div>
    );
}
