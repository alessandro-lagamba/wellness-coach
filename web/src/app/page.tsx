"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import Image from "next/image"
import { Typewriter } from "@/components/ui/typewriter"
import { MinimalistHero } from "@/components/ui/minimalist-hero"
import { Mascot } from '@/components/Mascot';
import { Footer } from '@/components/Footer';
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
  Volume2,
  VolumeX,
} from "lucide-react"
import { Button3D } from "@/components/ui/3d-button"

export default function Home() {
  const typewriterTexts = [
    "la tua salute",
    "la tua pelle",
    "la tua nutrizione",
    "le tue emozioni",
    "il tuo stile di vita",
  ]

  const [platform, setPlatform] = useState<"android" | "ios">("android")
  const [formStatus, setFormStatus] = useState<"idle" | "submitting" | "success" | "error">("idle")
  const [isMuted, setIsMuted] = useState(true)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setFormStatus("submitting")

    const form = e.currentTarget
    const formData = new FormData(form)
    formData.set("form-name", form.getAttribute("name") || "ios-beta-testers")

    const encodedData = new URLSearchParams()
    for (const [key, value] of formData.entries()) {
      if (typeof value === "string") {
        encodedData.append(key, value)
      }
    }

    try {
      const response = await fetch("/__forms.html", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: encodedData.toString(),
      })

      if (!response.ok) {
        throw new Error(`Netlify submission failed with status ${response.status}`)
      }

      setFormStatus("success")
    } catch (error) {
      console.error("Netlify form submission error:", error)
      setFormStatus("error")
    }
  }

  // Reordered: Live Coaching, Emotion Hub, Skin Analysis, Nutrition AI
  const features = [
    { icon: <Zap size={24} />, title: "Live Coaching", screenshot: "/screenshots/home.jpeg" },
    { icon: <Brain size={24} />, title: "Emotion Hub", screenshot: "/screenshots/emotion-new.jpeg" },
    { icon: <Camera size={24} />, title: "Skin Analysis", screenshot: "/screenshots/skin.jpeg" },
    { icon: <Utensils size={24} />, title: "Nutrition AI", screenshot: "/screenshots/nutrition-new.jpeg" },
  ]

  return (
    <main className="flex min-h-screen flex-col items-center justify-between font-sans selection:bg-sky-100 selection:text-sky-900 relative">


      {/* Hero Section with premium background */}
      <section id="monitor" className="relative w-full min-h-screen flex flex-col items-center justify-center px-4 pt-32 md:pt-20 pb-32 overflow-hidden bg-sky-100/60">
        {/* Animated gradient background layers */}
        <div className="absolute inset-0 bg-gradient-to-br from-white via-sky-200/30 to-purple-100/20" />

        <motion.div
          animate={{ x: [0, 50, 0], y: [0, -30, 0] }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute top-[-10%] right-[-10%] w-[800px] h-[800px] bg-sky-300/10 rounded-full blur-[120px]"
        />
        <motion.div
          animate={{ x: [0, -40, 0], y: [0, 60, 0] }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          className="absolute bottom-[-10%] left-[-10%] w-[700px] h-[700px] bg-purple-200/10 rounded-full blur-[120px]"
        />

        {/* Superior Fade Overlay for smooth transition to white below */}
        <div className="absolute bottom-0 left-0 right-0 h-64 bg-gradient-to-t from-white via-white/40 to-transparent pointer-events-none z-10" />

        {/* Floating app name */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8 }}
          className="absolute top-8 left-6 md:top-12 md:left-12 z-20 flex flex-col items-start"
        >
          <span className="text-6xl md:text-7xl lg:text-8xl font-black text-sky-900 tracking-tighter drop-shadow-sm leading-[0.8]">
            Yachai
          </span>
          <Button3D className="ml-2 mt-2 md:ml-4 md:mt-4 lg:ml-6 lg:mt-6" />
        </motion.div>

        <div className="relative z-10 max-w-5xl w-full text-center space-y-10 px-4">
          {/* Mascot Animation */}
          {/* Mascot Animation with Minimalist Style */}
          {/* Mascot Animation - Using Updated Component */}
          {/* Mascot Image - Positioned above text. Significantly increased negative margin for deep overlap */}
          <div className="flex justify-center w-full z-20 relative pointer-events-none
                -mb-20 sm:-mb-32 md:-mb-44 lg:-mb-56
                -translate-y-2 sm:-translate-y-6 md:-translate-y-12 lg:-translate-y-19
                -translate-x-1 sm:-translate-x-2 md:-translate-x-4 lg:-translate-x-5">
            <div className="origin-top">
              <Mascot
                state="happy"
                interactive={true}
                size={320} // valore base per mobile - modifica qui
                withGlow={false}
                className="sm:hidden" // nasconde su schermi più grandi
              />
              <Mascot
                state="happy"
                interactive={true}
                size={420}
                withGlow={false}
                className="hidden sm:block md:hidden" // solo tablet
              />
              <Mascot
                state="happy"
                interactive={true}
                size={550}
                withGlow={false}
                className="hidden md:block" // desktop
              />
            </div>
          </div>



          <h1 className="text-5xl md:text-8xl lg:text-9xl font-black tracking-tighter leading-[0.9] text-gray-900">
            Monitora <br />
            <div className="inline-block text-sky-500 drop-shadow-sm mt-2 md:mt-4 whitespace-nowrap overflow-hidden">
              <Typewriter
                text={typewriterTexts}
                speed={70}
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
            <span className="font-extrabold text-sky-900">Yachai</span>, il coach che ti aiuta ad ascoltare corpo e mente, grazie alla tecnologia più avanzata.
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
              className={`flex items-center space-x-2 px-6 py-3 rounded-xl transition-all font-bold text-base ${platform === "android" ? "bg-white text-sky-500 shadow-lg border border-sky-50" : "text-gray-400 hover:text-gray-600"}`}
            >
              <Smartphone size={20} />
              <span>Android</span>
            </button>
            <button
              onClick={() => setPlatform("ios")}
              className={`flex items-center space-x-2 px-6 py-3 rounded-xl transition-all font-bold text-base ${platform === "ios" ? "bg-white text-sky-500 shadow-lg border border-sky-50" : "text-gray-400 hover:text-gray-600"}`}
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
                    <a
                      href="https://github.com/alessandro-lagamba/wellness-coach-releases/releases/download/android-latest/Yachai.apk"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-12 py-8 bg-gradient-to-r from-sky-400 to-indigo-500 text-white rounded-[3rem] font-black text-2xl md:text-3xl hover:scale-105 active:scale-95 transition-all shadow-[0_25px_60px_-15px_rgba(56,189,248,0.4)] flex items-center gap-4 no-underline"
                    >
                      <Smartphone size={32} strokeWidth={3} />
                      Scarica ora Yachai!
                    </a>
                    <div className="flex flex-col items-center">
                      <p className="text-gray-400 font-bold flex items-center gap-2">
                        <Smartphone size={16} className="text-sky-500" />
                        Download diretto per Android
                      </p>
                      <span className="text-xs text-gray-400 font-medium sm:hidden mt-1">👆 Clicca per scaricare</span>
                    </div>
                  </div>

                  <div className="hidden md:flex flex-col items-center opacity-30">
                    <div className="w-px h-16 bg-sky-500" />
                    <span className="text-xs text-sky-700 font-bold py-3 uppercase tracking-widest">o</span>
                    <div className="w-px h-16 bg-sky-500" />
                  </div>

                  <div className="flex flex-col items-center space-y-4 p-8 rounded-[4rem] bg-white border-2 border-sky-50 shadow-2xl scale-110 md:scale-125 origin-center">
                    <div className="bg-sky-500 text-white px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-wider mb-1">
                      Solo per Android
                    </div>
                    <div className="relative p-2 bg-white rounded-2xl border-4 border-sky-500">
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=https://github.com/alessandro-lagamba/wellness-coach-releases/releases/download/android-latest/Yachai.apk&bgcolor=FFFFFF&color=0EA5E9`}
                        alt="Scan QR Code"
                        className="w-40 h-40 rounded-lg"
                      />
                    </div>
                    <div className="flex flex-col items-center text-center">
                      <span className="text-base font-black text-sky-500 uppercase tracking-tight">Scansiona QR</span>
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
                  className="max-w-2xl w-full bg-white rounded-[3rem] md:rounded-[4rem] p-8 md:p-14 shadow-[0_40px_100px_rgba(0,0,0,0.08)] border-2 border-sky-50 relative overflow-hidden group"
                >
                  <div className="absolute top-0 right-0 p-8 opacity-10 rotate-12 group-hover:rotate-0 transition-transform duration-700">
                    <Apple size={120} className="text-sky-500" />
                  </div>

                  <div className="relative z-10 space-y-8 text-left">
                    <div className="space-y-3">
                      <div className="inline-flex items-center space-x-2 px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-[10px] font-extrabold uppercase tracking-wider">
                        <Zap size={10} fill="currentColor" />
                        <span>Accesso Anticipato</span>
                      </div>
                      <h3 className="text-3xl md:text-4xl font-black text-gray-900 leading-none tracking-tight text-balance">
                        {formStatus === "success" ? "Richiesta Inviata! ✨" : "Diventa un Beta Tester"}
                      </h3>
                      <p className="text-gray-500 font-medium text-base md:text-lg leading-snug">
                        {formStatus === "success"
                          ? "Grazie per l'interesse! Controlla la tua email nei prossimi giorni per l'invito ufficiale a TestFlight."
                          : "La versione iOS è in fase di test privato. Compila il form per essere aggiunto al gruppo ufficiale su TestFlight."}
                      </p>
                    </div>

                    <AnimatePresence mode="wait">
                      {formStatus !== "success" ? (
                        <motion.form
                          key="ios-form"
                          initial={{ opacity: 1 }}
                          exit={{ opacity: 0, y: -20 }}
                          className="grid grid-cols-1 md:grid-cols-2 gap-4"
                          onSubmit={handleSubmit}
                          name="ios-beta-testers"
                          method="POST"
                          action="/__forms.html"
                          data-netlify="true"
                          data-netlify-honeypot="bot-field"
                        >
                          {/* Hidden Netlify Inputs */}
                          <input type="hidden" name="form-name" value="ios-beta-testers" />
                          <p className="hidden">
                            <label>Non compilare: <textarea name="bot-field"></textarea></label>
                          </p>

                          <div className="space-y-1.5 flex flex-col">
                            <label htmlFor="nome" className="text-[14px] font-black text-sky-600 uppercase tracking-widest ml-1">Nome</label>
                            <input id="nome" name="nome" type="text" required placeholder="Esempio: Mario" className="w-full px-5 py-4 bg-gray-50 border-2 border-transparent focus:border-sky-500 focus:bg-white rounded-2xl outline-none transition-all font-bold placeholder:text-gray-300 placeholder:font-normal" />
                          </div>
                          <div className="space-y-1.5 flex flex-col">
                            <label htmlFor="cognome" className="text-[14px] font-black text-sky-600 uppercase tracking-widest ml-1">Cognome</label>
                            <input id="cognome" name="cognome" type="text" required placeholder="Esempio: Rossi" className="w-full px-5 py-4 bg-gray-50 border-2 border-transparent focus:border-sky-500 focus:bg-white rounded-2xl outline-none transition-all font-bold placeholder:text-gray-300 placeholder:font-normal" />
                          </div>
                          <div className="md:col-span-2 space-y-1.5 flex flex-col">
                            <label htmlFor="email" className="text-[14px] font-black text-sky-600 uppercase tracking-widest ml-1">E-mail del tuo Apple ID</label>
                            <input id="email" name="email" type="email" required placeholder="latuamail@icloud.com" className="w-full px-5 py-4 bg-gray-50 border-2 border-transparent focus:border-sky-500 focus:bg-white rounded-2xl outline-none transition-all font-bold placeholder:text-gray-300 placeholder:font-normal" />
                          </div>
                          <div className="md:col-span-2 pt-4">
                            <button
                              type="submit"
                              disabled={formStatus === "submitting"}
                              className="w-full py-6 bg-gray-900 text-white rounded-[2rem] font-black text-xl hover:bg-sky-600 hover:scale-[1.02] active:scale-95 transition-all shadow-2xl flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {formStatus === "submitting" ? "Invio in corso..." : "Richiedi accesso Beta"}
                              <ArrowRight size={24} strokeWidth={3} />
                            </button>
                            {formStatus === "error" && (
                              <p className="text-red-500 text-xs font-bold mt-2 text-center">Si è verificato un errore. Riprova più tardi.</p>
                            )}
                          </div>
                        </motion.form>
                      ) : (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="py-10 text-center"
                        >
                          <div className="w-20 h-20 bg-sky-100 text-sky-600 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Zap size={40} fill="currentColor" />
                          </div>
                          <button
                            onClick={() => setFormStatus("idle")}
                            className="text-sky-600 font-bold text-sm hover:underline"
                          >
                            Invia un&apos;altra richiesta
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <div className="p-5 bg-sky-50 rounded-3xl border border-sky-100 flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-white flex-shrink-0 flex items-center justify-center shadow-sm">
                        <Image src="/screenshots/yachai-icon.png" width={24} height={24} alt="icon" className="rounded-md" />
                      </div>
                      <p className="text-sm text-sky-800 font-bold leading-relaxed pt-1">
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
          <div className="w-6 h-10 rounded-full border-2 border-sky-200 flex items-start justify-center pt-2">
            <div className="w-1 h-2 bg-sky-400 rounded-full" />
          </div>
        </motion.div>
      </section>

      {/* Features Section with App Screenshots - Smooth gradient transition starting from half height */}
      <section className="w-full py-32 px-6 bg-gradient-to-b from-white via-white via-60% to-sky-100 relative z-20">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-2xl mx-auto mb-20 px-4"
          >
            <div
              className="relative rounded-[2.5rem] md:rounded-[3rem] overflow-hidden shadow-[0_50px_100px_-20px_rgba(0,0,0,0.3)] border-8 border-white bg-white cursor-pointer group/video"
              onClick={() => setIsMuted(!isMuted)}
            >
              <div className="aspect-[5/8] md:aspect-[3/5] overflow-hidden">
                <video
                  src="/screenshots/yachai-video-edit.mp4"
                  autoPlay
                  muted={isMuted}
                  loop
                  playsInline
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Mute/Unmute Overlay */}
              <div className="absolute top-4 right-4 z-30 p-3 rounded-full bg-black/20 backdrop-blur-md text-white opacity-0 group-hover/video:opacity-100 transition-opacity">
                {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
              </div>

              {/* Interaction prompt */}
              <div className="absolute inset-0 flex items-center justify-center bg-black/10 opacity-0 group-hover/video:opacity-100 transition-opacity pointer-events-none">
                <span className="bg-white/90 text-sky-900 px-6 py-2 rounded-full font-black text-sm uppercase tracking-widest shadow-xl">
                  {isMuted ? "Clicca per l'audio" : "Muta audio"}
                </span>
              </div>

              <div className="absolute inset-0 bg-gradient-to-t from-gray-900/10 to-transparent pointer-events-none" />
            </div>
          </motion.div>

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
              <span className="font-extrabold text-sky-600">Yachai</span>, benessere reale supportato dall&apos;IA.
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
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-sky-400 to-indigo-500 flex items-center justify-center text-white shadow-lg group-hover:rotate-6 transition-transform">
                    {feature.icon}
                  </div>
                  <h3 className="font-black text-xl text-gray-900 group-hover:text-sky-600 transition-colors">{feature.title}</h3>
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

      {/* Final CTA Section - Smooth gradient transition from celeste to muted purple */}
      <section className="w-full pt-32 pb-40 px-6 bg-gradient-to-b from-sky-100 via-indigo-600/90 to-purple-950 relative z-20 overflow-hidden text-center">
        {/* Decorative background elements - subtle noise only */}
        <div className="absolute top-0 left-0 w-full h-full bg-white/5 pointer-events-none" />

        <div className="relative z-10 max-w-5xl mx-auto flex flex-col items-center">
          {/* App Icon */}
          <div className="mb-12 p-3 bg-white rounded-[2rem] shadow-xl border border-sky-100/50">
            <div className="rounded-[1.5rem] overflow-hidden">
              <Image
                src="/screenshots/yachai-icon.png"
                width={140}
                height={140}
                alt="Yachai Icon"
                className="object-cover"
              />
            </div>
          </div>




          <h2 className="text-5xl md:text-7xl font-black mb-8 tracking-tighter text-white drop-shadow-sm">
            Inizia oggi il tuo percorso di benessere con Yachai!
          </h2>
          <p className="text-xl md:text-2xl text-sky-50 max-w-2xl mx-auto font-medium mb-16 leading-relaxed">
            Scarica <span className="font-extrabold text-white">Yachai</span> gratuitamente e scopri come la tecnologia può trasformare la tua salute.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-10">
            <a
              href="https://github.com/alessandro-lagamba/wellness-coach-releases/releases/download/android-latest/Yachai.apk"
              target="_blank"
              rel="noopener noreferrer"
              className="px-14 py-8 bg-white text-purple-700 rounded-[3rem] font-black text-2xl hover:scale-105 active:scale-95 transition-all shadow-[0_30px_60px_-10px_rgba(0,0,0,0.3)] flex items-center gap-4 no-underline"
            >
              <Smartphone size={32} />
              Scarica Yachai
            </a>
            <div className="flex flex-col items-center space-y-4 p-6 rounded-[3rem] bg-white/10 backdrop-blur-xl border border-white/20">
              <div className="flex items-center gap-3 text-white">
                <ScanLine size={20} />
                <span className="text-sm font-black uppercase tracking-widest">Scansiona ora (Android)</span>
              </div>
              <div className="p-2 bg-white rounded-2xl shadow-xl">
                <img
                  src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=https://github.com/alessandro-lagamba/wellness-coach-releases/releases/download/android-latest/Yachai.apk&bgcolor=FFFFFF&color=6366F1"
                  alt="Scan QR Code"
                  className="w-32 h-32 rounded-lg"
                />
              </div>
            </div>
          </div>
        </div>
      </section>




      {/* Footer - Integrated transition */}
      <Footer />

      {/* Netlify Form Discovery (Ghost Form) */}
      <form name="ios-beta-testers" data-netlify="true" netlify-honeypot="bot-field" hidden>
        <input type="hidden" name="form-name" value="ios-beta-testers" />
        <input type="text" name="nome" />
        <input type="text" name="cognome" />
        <input type="email" name="email" />
        <textarea name="bot-field"></textarea>
      </form>

    </main >
  )
}
