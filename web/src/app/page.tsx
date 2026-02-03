import { motion } from "framer-motion"
import { Typewriter } from "@/components/ui/typewriter"
import { AppDownloadSection } from "@/components/ui/app-download-section"
import {
  Brain,
  Camera,
  Utensils,
  Heart,
  Smartphone,
  CheckCircle2,
  Zap,
} from "lucide-react"

export default function Home() {
  const typewriterTexts = [
    "la tua salute",
    "la tua pelle",
    "la tua nutrizione",
    "le tue emozioni",
    "il tuo stile di vita",
  ]

  const downloadProps = {
    title: "Porta il tuo Wellness Coach ovunque",
    subtitle: "Sblocca il potenziale della tua salute con analisi AI in tempo reale, consigli personalizzati e monitoraggio costante.",
    features: [
      { icon: <Brain size={24} />, title: "Emotion Hub" },
      { icon: <Camera size={24} />, title: "Skin Analysis" },
      { icon: <Utensils size={24} />, title: "Nutrition AI" },
      { icon: <Zap size={24} />, title: "Live Coaching" },
    ],
    benefits: [
      { icon: <CheckCircle2 size={18} />, title: "Analisi Real-time" },
      { icon: <CheckCircle2 size={18} />, title: "Privacy Assicurata" },
      { icon: <CheckCircle2 size={18} />, title: "Consigli Medici" },
      { icon: <CheckCircle2 size={18} />, title: "Sync con HealthKit" },
    ],
    qrCodeUrl: "https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=https://wellnesscoach.app",
    qrCodeAlt: "Inquadra per scaricare WellnessCoach",
    mainImageUrl: "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?q=80&w=1000&auto=format&fit=crop",
    mainImageAlt: "WellnessCoach App Preview",
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-between">
      {/* Hero Section with Typewriter */}
      <section className="w-full flex flex-col items-center justify-center py-24 px-6 md:py-48 bg-gradient-to-b from-background via-background to-primary/5">
        <div className="max-w-4xl text-center space-y-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-bold border border-primary/20"
          >
            <Zap size={14} className="fill-current" />
            <span>Nuovo: Analisi della pelle AI 2.0</span>
          </motion.div>

          <h1 className="text-5xl md:text-8xl font-black tracking-tight leading-[1.1]">
            Monitora <br />
            <Typewriter
              text={typewriterTexts}
              speed={70}
              className="text-primary"
              waitTime={2000}
              deleteSpeed={40}
              cursorChar={"_"}
            />
          </h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.8 }}
            className="text-lg md:text-2xl text-muted-foreground max-w-2xl mx-auto leading-relaxed"
          >
            WellnessCoach è l'assistente AI definitivo che ti aiuta a capire il tuo corpo e la tua mente attraverso la tecnologia più avanzata.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.6, type: "spring" }}
            className="pt-8"
          >
            <button className="px-10 py-5 bg-primary text-primary-foreground rounded-full font-black text-xl hover:scale-105 active:scale-95 transition-all shadow-2xl shadow-primary/30">
              Scarica ora l'App
            </button>
          </motion.div>
        </div>
      </section>

      {/* Download Section */}
      <AppDownloadSection {...downloadProps} className="bg-muted/10" />

      {/* Simple Footer */}
      <footer className="w-full py-12 px-6 border-t text-center text-muted-foreground">
        <p>© 2026 WellnessCoach. Tutti i diritti riservati.</p>
      </footer>
    </main>
  )
}
