import Link from 'next/link';
import Image from 'next/image';

export function Footer() {
    return (
        <footer className="w-full py-16 px-6 bg-gray-900 text-center relative z-20">
            <div className="max-w-7xl mx-auto space-y-6">
                <div className="flex items-center justify-center space-x-2">
                    <Image src="/screenshots/yachai-icon.png" width={24} height={24} alt="icon" className="rounded-md" />
                    <span className="text-white font-black text-xl tracking-tight">Yachai</span>
                </div>

                <div className="h-px w-20 bg-purple-500/30 mx-auto" />

                <div className="flex justify-center space-x-6 text-sm">
                    <Link href="/privacy" className="text-gray-400 hover:text-purple-400 transition-colors">
                        Privacy Policy
                    </Link>
                    <Link href="/terms" className="text-gray-400 hover:text-purple-400 transition-colors">
                        Termini di Servizio
                    </Link>
                </div>

                <p className="text-gray-400 font-medium text-sm">
                    © {new Date().getFullYear()} Yachai. Tutti i diritti riservati.
                </p>

                <p className="text-gray-500 text-xs font-bold uppercase tracking-[0.2em]">
                    Un prodotto di <span className="text-white">LaBella&Partners S.R.L.</span>
                </p>
            </div>
        </footer>
    );
}
