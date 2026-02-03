"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import Image from "next/image"
import { Typewriter } from "@/components/ui/typewriter"
import {
  Brain,
  Camera,
  Utensils,
  Zap,
  Smartphone,
  ScanLine,
  Apple,
  Chrome,
  ArrowRight,
} from "lucide-react"

export default function Home() {
  const typewriterTexts = [
    "la tua salute",
    "la tua pelle",
    "la tua nutrizione",
    "le tue emozioni",
    "il tuo stile di vita",
  ]

  const [platform, setPlatform] = useState<"android" | "ios">("android")

  // Reordered: Live Coaching, Emotion Hub, Skin Analysis, Nutrition AI
  const features = [
    { icon: <Zap size={24} />, title: "Live Coaching", screenshot: "/screenshots/home.jpeg" },
    { icon: <Brain size={24} />, title: "Emotion Hub", screenshot: "/screenshots/emotion.jpeg" },
    { icon: <Camera size={24} />, title: "Skin Analysis", screenshot: "/screenshots/skin.jpeg" },
    { icon: <Utensils size={24} />, title: "Nutrition AI", screenshot: "/screenshots/nutrition.jpeg" },
  ]

  return (
    <main className="flex min-h-screen flex-col items-center justify-between font-sans selection:bg-emerald-100 selection:text-emerald-900">
      {/* Hero Section with premium background */}
      <section className="relative w-full min-h-screen flex flex-col items-center justify-center px-4 pt-20 pb-32 overflow-hidden bg-white">
        {/* Animated gradient background layers */}
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/80 via-white to-teal-50/50" />
        <motion.div
          animate={{ x: [0, 50, 0], y: [0, -30, 0] }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute top-[-10%] right-[-10%] w-[800px] h-[800px] bg-emerald-200/20 rounded-full blur-[120px]"
        />
        <motion.div
          animate={{ x: [0, -40, 0], y: [0, 60, 0] }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          className="absolute bottom-[-10%] left-[-10%] w-[700px] h-[700px] bg-teal-200/20 rounded-full blur-[120px]"
        />

        {/* Superior Fade Overlay for smooth transition to white below */}
        <div className="absolute bottom-0 left-0 right-0 h-64 bg-gradient-to-t from-white via-white/80 to-transparent pointer-events-none z-10" />

        {/* Floating app icon */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8 }}
          className="absolute top-8 left-8 md:top-12 md:left-12 z-20"
        >
          <div className="relative group p-1 bg-white rounded-3xl shadow-2xl border border-emerald-100/50">
            <Image
              src="/screenshots/icona.png"
              alt="WellnessCoach Icon"
              width={72}
              height={72}
              className="rounded-2xl transition-transform group-hover:scale-105"
            />
          </div>
        </motion.div>

        <div className="relative z-10 max-w-5xl w-full text-center space-y-10 px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center space-x-2 px-6 py-2.5 rounded-full bg-emerald-500/10 text-emerald-700 text-sm font-bold border border-emerald-500/20 shadow-sm"
          >
            <Zap size={16} className="fill-emerald-500 text-emerald-500 animate-pulse" />
            <span>Nuovo: Analisi della pelle AI 2.0</span>
          </motion.div>

          <h1 className="text-5xl md:text-9xl font-black tracking-tight leading-[1.05] text-gray-900">
            Monitora <br />
            <div className="h-[1.2em] flex items-center justify-center">
              <Typewriter
                text={typewriterTexts}
                speed={70}
                className="text-emerald-600 drop-shadow-sm"
                waitTime={2000}
                deleteSpeed={40}
                cursorChar={"_"}
              />
            </div>
          </h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.8 }}
            className="text-lg md:text-3xl text-gray-500 max-w-3xl mx-auto leading-tight font-medium"
          >
            WellnessCoach è l&apos;assistente definitivo che ti aiuta a capire il tuo corpo e la tua mente attraverso la tecnologia più avanzata.
          </motion.p>

          {/* Platform Switcher */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="flex p-1 bg-gray-100/80 backdrop-blur-sm rounded-2xl w-fit mx-auto border border-gray-200 shadow-inner"
          >
            <button
              onClick={() => setPlatform("android")}
              className={`flex items-center space-x-2 px-6 py-3 rounded-xl transition-all font-bold text-base ${platform === "android" ? "bg-white text-emerald-600 shadow-md border border-emerald-100" : "text-gray-500 hover:text-gray-700"}`}
            >
              <Smartphone size={20} />
              <span>Android</span>
            </button>
            <button
              onClick={() => setPlatform("ios")}
              className={`flex items-center space-x-2 px-6 py-3 rounded-xl transition-all font-bold text-base ${platform === "ios" ? "bg-white text-emerald-600 shadow-md border border-emerald-100" : "text-gray-500 hover:text-gray-700"}`}
            >
              <Apple size={20} />
              <span>iOS (Beta)</span>
            </button>
          </motion.div>

          {/* CTA Area with Platform Logic */}
          <div className="min-h-[500px] md:min-h-[400px] flex items-center justify-center pt-4">
            <AnimatePresence mode="wait">
              {platform === "android" ? (
                <motion.div
                  key="android-cta"
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -10 }}
                  className="flex flex-col md:flex-row items-center justify-center gap-12 w-full"
                >
                  <div className="flex flex-col items-center space-y-4">
                    <button className="px-12 py-8 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-[3rem] font-black text-2xl md:text-3xl hover:scale-105 active:scale-95 transition-all shadow-[0_25px_60px_-15px_rgba(16,185,129,0.4)] flex items-center gap-4">
                      <Smartphone size={32} strokeWidth={3} />
                      Scarica ora l&apos;App
                    </button>
                    <div className="flex flex-col items-center">
                      <p className="text-gray-400 font-bold flex items-center gap-2">
                        <Smartphone size={16} className="text-emerald-500" />
                        Download diretto per Android
                      </p>
                      <span className="text-xs text-gray-400 font-medium sm:hidden mt-1">👆 Clicca per scaricare</span>
                    </div>
                  </div>

                  <div className="hidden md:flex flex-col items-center opacity-30">
                    <div className="w-px h-16 bg-emerald-500" />
                    <span className="text-xs text-emerald-700 font-bold py-3 uppercase tracking-widest">o</span>
                    <div className="w-px h-16 bg-emerald-500" />
                  </div>

                  <div className="flex flex-col items-center space-y-4 p-8 rounded-[4rem] bg-white border-2 border-emerald-50 shadow-2xl scale-110 md:scale-125 origin-center">
                    <div className="bg-emerald-500 text-white px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-wider mb-1">
                      Solo per Android
                    </div>
                    <div className="relative p-2 bg-white rounded-2xl border-4 border-emerald-500">
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=https://wellnesscoach.app&bgcolor=FFFFFF&color=059669`}
                        alt="Scan QR Code"
                        className="w-40 h-40 rounded-lg"
                      />
                    </div>
                    <div className="flex flex-col items-center text-center">
                      <span className="text-base font-black text-emerald-600 uppercase tracking-tight">Scansiona QR</span>
                      <span className="text-[10px] text-gray-400 font-bold leading-none uppercase tracking-widest">Usa la fotocamera</span>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="ios-cta"
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -10 }}
                  className="max-w-2xl w-full bg-white rounded-[3rem] md:rounded-[4rem] p-8 md:p-14 shadow-[0_40px_100px_rgba(0,0,0,0.08)] border-2 border-emerald-50 relative overflow-hidden group"
                >
                  <div className="absolute top-0 right-0 p-8 opacity-10 rotate-12 group-hover:rotate-0 transition-transform duration-700">
                    <Apple size={120} className="text-emerald-500" />
                  </div>

                  <div className="relative z-10 space-y-8 text-left">
                    <div className="space-y-3">
                      <div className="inline-flex items-center space-x-2 px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-[10px] font-extrabold uppercase tracking-wider">
                        <Zap size={10} fill="currentColor" />
                        <span>Accesso Anticipato</span>
                      </div>
                      <h3 className="text-3xl md:text-4xl font-black text-gray-900 leading-none tracking-tight">Diventa un Beta Tester</h3>
                      <p className="text-gray-500 font-medium text-base md:text-lg leading-snug">
                        La versione iOS è in fase di test privato. Compila il form per farti aggiungere al gruppo ufficiale su <strong>TestFlight</strong>.
                      </p>
                    </div>

                    <form className="grid grid-cols-1 md:grid-cols-2 gap-4" onSubmit={(e) => e.preventDefault()}>
                      <div className="space-y-1.5 flex flex-col">
                        <label className="text-[10px] font-black text-emerald-600 uppercase tracking-widest ml-1">Nome</label>
                        <input type="text" placeholder="Esempio: Mario" className="w-full px-5 py-4 bg-gray-50 border-2 border-transparent focus:border-emerald-500 focus:bg-white rounded-2xl outline-none transition-all font-bold placeholder:text-gray-300 placeholder:font-normal" />
                      </div>
                      <div className="space-y-1.5 flex flex-col">
                        <label className="text-[10px] font-black text-emerald-600 uppercase tracking-widest ml-1">Cognome</label>
                        <input type="text" placeholder="Esempio: Rossi" className="w-full px-5 py-4 bg-gray-50 border-2 border-transparent focus:border-emerald-500 focus:bg-white rounded-2xl outline-none transition-all font-bold placeholder:text-gray-300 placeholder:font-normal" />
                      </div>
                      <div className="md:col-span-2 space-y-1.5 flex flex-col">
                        <label className="text-[10px] font-black text-emerald-600 uppercase tracking-widest ml-1">Email (Apple ID)</label>
                        <input type="email" placeholder="latuamail@icloud.com" className="w-full px-5 py-4 bg-gray-50 border-2 border-transparent focus:border-emerald-500 focus:bg-white rounded-2xl outline-none transition-all font-bold placeholder:text-gray-300 placeholder:font-normal" />
                      </div>
                      <div className="md:col-span-2 pt-4">
                        <button className="w-full py-6 bg-gray-900 text-white rounded-[2rem] font-black text-xl hover:bg-emerald-600 hover:scale-[1.02] active:scale-95 transition-all shadow-2xl flex items-center justify-center gap-3">
                          Richiedi accesso Beta
                          <ArrowRight size={24} strokeWidth={3} />
                        </button>
                      </div>
                    </form>

                    <div className="p-5 bg-emerald-50 rounded-3xl border border-emerald-100 flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-white flex-shrink-0 flex items-center justify-center shadow-sm">
                        <Image src="/screenshots/icona.png" width={24} height={24} alt="icon" className="rounded-md" />
                      </div>
                      <p className="text-sm text-emerald-800 font-bold leading-relaxed pt-1">
                        Una volta registrato, riceverai un&apos;email di invito da Apple per testare l&apos;app in anteprima su TestFlight.
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, y: [0, 10, 0] }}
          transition={{ delay: 1.5, duration: 1.5, repeat: Infinity }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20"
        >
          <div className="w-6 h-10 rounded-full border-2 border-emerald-200 flex items-start justify-center pt-2">
            <div className="w-1 h-2 bg-emerald-400 rounded-full" />
          </div>
        </motion.div>
      </section>

      {/* Features Section with App Screenshots - Smooth gradient transition */}
      <section className="w-full py-32 px-6 bg-white relative z-20">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-20"
          >
            <h2 className="text-5xl md:text-7xl font-black text-gray-900 mb-6 tracking-tight">
              Tutto quello di cui hai bisogno
            </h2>
            <p className="text-xl md:text-2xl text-gray-400 max-w-3xl mx-auto font-medium">
              Funzionalità avanzate basate su AI per monitorare ogni aspetto del tuo benessere
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="group relative bg-white rounded-[3rem] p-6 border border-gray-100 hover:shadow-[0_40px_80px_-15px_rgba(0,0,0,0.1)] transition-all duration-500 hover:-translate-y-4"
              >
                {/* Feature icon */}
                <div className="flex items-center space-x-4 mb-6">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-white shadow-xl group-hover:rotate-6 transition-transform">
                    {feature.icon}
                  </div>
                  <h3 className="font-black text-xl text-gray-900">{feature.title}</h3>
                </div>

                {/* Screenshot - Enhanced size and presentation */}
                <div className="relative aspect-[9/19] rounded-[2rem] overflow-hidden shadow-2xl border border-gray-100 group-hover:scale-[1.02] transition-transform duration-500">
                  <Image
                    src={feature.screenshot}
                    alt={feature.title}
                    fill
                    className="object-cover object-top"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-gray-900/10 to-transparent pointer-events-none" />
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA Section - Smooth gradient transition */}
      <section className="w-full py-40 px-6 bg-gradient-to-b from-white via-emerald-600 to-emerald-700 text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_50%_50%,_var(--tw-gradient-stops))] from-white to-transparent" />

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative z-10 max-w-4xl mx-auto text-center"
        >
          <div className="p-3 bg-white w-fit mx-auto rounded-[2.5rem] shadow-2xl mb-10">
            <Image
              src="/screenshots/icona.png"
              alt="WellnessCoach"
              width={100}
              height={100}
              className="rounded-[2rem]"
            />
          </div>
          <h2 className="text-5xl md:text-7xl font-black mb-8 tracking-tighter">
            Inizia oggi il tuo percorso di benessere
          </h2>
          <p className="text-xl md:text-2xl text-emerald-50 max-w-2xl mx-auto font-medium mb-16 leading-relaxed">
            Scarica WellnessCoach gratuitamente e scopri come la tecnologia può trasformare la tua salute.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-10">
            <button className="px-14 py-8 bg-white text-emerald-600 rounded-[3rem] font-black text-2xl hover:scale-105 active:scale-95 transition-all shadow-[0_30px_60px_-10px_rgba(0,0,0,0.3)] flex items-center gap-4">
              <Smartphone size={32} />
              Scarica gratis
            </button>
            <div className="flex flex-col items-center space-y-4 p-6 rounded-[3rem] bg-white/10 backdrop-blur-xl border border-white/20">
              <div className="flex items-center gap-3 text-white">
                <ScanLine size={20} />
                <span className="text-sm font-black uppercase tracking-widest">Scansiona ora (Android)</span>
              </div>
              <div className="p-2 bg-white rounded-2xl">
                <img
                  src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=https://wellnesscoach.app&bgcolor=FFFFFF&color=059669"
                  alt="Scan QR Code"
                  className="w-32 h-32 rounded-lg"
                />
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Footer - Integrated transition */}
      <footer className="w-full py-16 px-6 bg-gray-900 text-center relative z-20">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center justify-center space-x-2">
            <Image src="/screenshots/icona.png" width={24} height={24} alt="icon" className="rounded-md" />
            <span className="text-white font-black text-xl tracking-tight">WellnessCoach</span>
          </div>
          <div className="h-px w-20 bg-emerald-500/30 mx-auto" />
          <p className="text-gray-400 font-medium">© 2026 WellnessCoach. Tutti i diritti riservati.</p>
          <p className="text-gray-500 text-sm font-bold uppercase tracking-[0.2em]">
            Un prodotto di <span className="text-white">LaBella&Partners</span>
          </p>
        </div>
      </footer>
    </main>
  )
}
