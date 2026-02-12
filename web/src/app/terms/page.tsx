import { Footer } from '../../components/Footer';

export default function TermsPage() {
    return (
        <div className="min-h-screen bg-gray-950 text-gray-200 font-sans selection:bg-purple-500/30">
            <div className="max-w-4xl mx-auto px-6 py-12 md:py-20">
                <h1 className="text-3xl md:text-5xl font-bold text-white mb-2">Termini e Condizioni d'Uso</h1>
                <p className="text-purple-400 font-medium mb-8">Versione 1.0</p>

                <div className="bg-gray-900/50 p-6 rounded-lg border border-gray-800 mb-12 text-sm leading-relaxed">
                    <p><strong>Data di efficacia:</strong> 11/02/2026</p>
                    <p><strong>Ultima modifica:</strong> 11/02/2026</p>
                    <hr className="border-gray-800 my-4" />
                    <p>
                        <strong>IMPORTANTE: LEGGERE ATTENTAMENTE PRIMA DELL'USO.</strong><br />
                        Utilizzando l'App Yachai, l'Utente accetta integralmente i presenti Termini. Se non si accettano i Termini, <strong>non utilizzare l'App</strong>.
                    </p>
                </div>

                <div className="space-y-12 text-gray-300 leading-relaxed">

                    <section>
                        <h2 className="text-2xl font-bold text-white mb-4">1. Definizioni</h2>
                        <ul className="list-disc pl-5 space-y-2 marker:text-purple-500">
                            <li><strong>App:</strong> L'applicazione mobile Yachai.</li>
                            <li><strong>Utente:</strong> La persona fisica che utilizza l'App.</li>
                            <li><strong>Fornitore:</strong> LaBella&Partners S.R.L.</li>
                            <li><strong>Fase Beta:</strong> Periodo di test pre-lancio pubblico.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-white mb-4">2. Accettazione dei Termini</h2>
                        <p>Creando un Account o utilizzando l'App, dichiari di aver letto, compreso e accettato i presenti Termini e l'Informativa Privacy. I Termini costituiscono un contratto vincolante.</p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-white mb-4">3. Requisiti di Accesso ed Età</h2>
                        <div className="bg-red-900/20 border border-red-500/30 p-4 rounded-lg mb-4">
                            <p className="font-bold text-red-200">Età minima: 16 Anni</p>
                            <p className="text-sm">Per utilizzare l'App durante la fase Beta, devi avere almeno 16 anni. L'inserimento di dati falsi comporta la cancellazione dell'Account.</p>
                        </div>
                        <p>Sei responsabile della veridicità dei dati forniti e della sicurezza delle tue credenziali di accesso.</p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-white mb-4">5. Natura dei Servizi e Limitazioni</h2>
                        <div className="bg-yellow-900/20 border border-yellow-500/30 p-4 rounded-lg space-y-4">
                            <div>
                                <h3 className="text-lg font-bold text-yellow-200 flex items-center gap-2">⚠️ NON È UN DISPOSITIVO MEDICO</h3>
                                <p className="text-sm mt-1">L'App <strong>NON fornisce diagnosi, trattamenti o terapie</strong>. Le raccomandazioni sono suggerimenti generici di benessere e non sostituiscono il parere di un medico.</p>
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-yellow-200">Nessuna garanzia di risultati</h3>
                                <p className="text-sm mt-1">Il Fornitore non garantisce specifici risultati di salute. I risultati dipendono da fattori personali non controllabili dall'App.</p>
                            </div>
                        </div>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-white mb-4">6. Obblighi dell'Utente</h2>
                        <p className="mb-4">Ti impegni a usare l'App in modo lecito. È vietato:</p>
                        <ul className="list-disc pl-5 space-y-1 marker:text-purple-500">
                            <li>Caricare contenuti offensivi o illeciti.</li>
                            <li>Tentare di accedere abusivamente ai sistemi (hacking).</li>
                            <li>Utilizzare l'App per fini commerciali senza autorizzazione.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-white mb-4">7. Proprietà Intellettuale</h2>
                        <p>L'App, il codice, il design e i contenuti sono proprietà esclusiva del Fornitore. Ti è concessa una licenza personale, non esclusiva e revocabile per l'uso dell'App.</p>
                        <p className="mt-2 text-sm italic">Mantieni la proprietà dei contenuti che carichi (es. diario), ma concedi al Fornitore una licenza per elaborarli al fine di fornirti il servizio.</p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-white mb-4">12. Programma Beta</h2>
                        <div className="bg-purple-900/20 border border-purple-500/30 p-4 rounded-lg">
                            <h3 className="font-bold text-white mb-2">Condizioni Speciali Beta</h3>
                            <ul className="list-disc pl-5 space-y-2 text-sm">
                                <li>L'accesso è gratuito e limitato.</li>
                                <li>L'App può contenere bug ed essere instabile.</li>
                                <li><strong>Cancellazione Dati:</strong> I dati della beta saranno cancellati entro 30 giorni dal termine del test, salvo passaggio a piano a pagamento.</li>
                                <li>Fornendo feedback, cedi al Fornitore il diritto di utilizzarli per migliorare il prodotto.</li>
                            </ul>
                        </div>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-white mb-4">13. Limitazione di Responsabilità</h2>
                        <p className="mb-4">L'App è fornita "COSÌ COM'È". Nei limiti di legge, il Fornitore non è responsabile per danni indiretti o danni alla salute derivanti dall'uso improprio o dall'affidamento esclusivo alle raccomandazioni dell'App.</p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-white mb-4">15. Legge Applicabile</h2>
                        <p>I presenti Termini sono disciplinati dalla <strong>legge italiana</strong>. Per i consumatori UE, il foro competente è quello di residenza.</p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-white mb-4">Contatti</h2>
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
