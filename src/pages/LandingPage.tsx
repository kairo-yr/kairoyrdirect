import { motion } from 'framer-motion';
import {
  ArrowRight,
  BarChart3,
  CalendarCheck,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  GraduationCap,
  PlayCircle,
  ShieldCheck,
  UsersRound,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { FeatureCard } from '../components/landing/FeatureCard';
import { BrandMark } from '../components/ui/BrandMark';
import { RoadmapBadge } from '../components/ui/RoadmapBadge';
import { APP_NAME, APP_TAGLINE, PLAY_APP_NAME, SUPPORT_TEXT } from '../config/brand';
import { features } from '../data/mockData';

const featureIcons = [GraduationCap, ClipboardList, UsersRound, CalendarCheck, BarChart3, CreditCard, ShieldCheck, PlayCircle];

export function LandingPage() {
  return (
    <main className="bg-cream text-navy">
      <section className="mx-auto flex min-h-screen max-w-7xl flex-col px-5 py-6">
        <nav className="flex items-center justify-between">
          <BrandMark />
          <Link className="rounded-full bg-white px-4 py-2 text-sm font-black text-navy shadow-card" to="/login">
            Login
          </Link>
        </nav>

        <div className="grid flex-1 items-center gap-12 py-16 lg:grid-cols-2">
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <div className="mb-5 inline-flex rounded-full bg-white px-4 py-2 text-sm font-black text-directBlue shadow-card">
              {APP_NAME} for academies and independent chess coaches
            </div>
            <h1 className="max-w-3xl text-5xl font-black leading-tight tracking-tight md:text-7xl">
              {APP_TAGLINE}
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-700">
              Manage students, batches, coaches, attendance readiness, class reports, fee visibility,
              parent updates, and future {PLAY_APP_NAME} access from one premium SaaS workspace.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link className="inline-flex items-center gap-2 rounded-full bg-directBlue px-5 py-3 text-sm font-black text-white shadow-soft" to="/dashboard">
                View Dashboard <ArrowRight size={18} />
              </Link>
              <a className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-black text-navy shadow-card" href="#features">
                Explore Features
              </a>
            </div>
          </motion.div>

          <motion.div
            className="rounded-3xl border border-white bg-white/85 p-5 shadow-soft backdrop-blur"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.55, delay: 0.1 }}
          >
            <div className="rounded-2xl bg-navy p-5 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xs font-black uppercase tracking-widest text-blue-200">Academy overview</p>
                    <RoadmapBadge status="Mock Data" />
                  </div>
                  <h2 className="mt-2 text-2xl font-black">This week in Direct</h2>
                </div>
                <CheckCircle2 className="text-directGold" />
              </div>
              <div className="mt-8 grid grid-cols-3 gap-3">
                {[
                  ['186', 'Students'],
                  ['24', 'Batches'],
                  ['132', 'Reports'],
                ].map(([value, label]) => (
                  <div className="rounded-2xl bg-white/10 p-4" key={label}>
                    <div className="text-2xl font-black">{value}</div>
                    <div className="text-xs text-slate-300">{label}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {['Attendance roadmap', 'Fee visibility', 'Coach allocation', `${PLAY_APP_NAME} access`].map((item) => (
                <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm font-bold text-slate-700" key={item}>
                  {item}
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      <section className="bg-white py-20">
        <div className="mx-auto max-w-7xl px-5">
          <div className="max-w-3xl">
            <p className="text-sm font-black uppercase tracking-widest text-directGold">The problem</p>
            <h2 className="mt-3 text-4xl font-black tracking-tight">Academy operations deserve a system parents and coaches can trust.</h2>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-5">
            {['Attendance scattered in notebooks', 'Parent updates are inconsistent', 'Fee tracking is manual', 'Coaches and batches are hard to manage', 'Student progress is not clearly visible'].map((problem) => (
              <div className="rounded-2xl bg-slate-50 p-5 text-sm font-bold leading-6 text-slate-700" key={problem}>
                {problem}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-slate-50 py-20" id="features">
        <div className="mx-auto max-w-7xl px-5">
          <div className="max-w-3xl">
            <p className="text-sm font-black uppercase tracking-widest text-directBlue">Features</p>
            <h2 className="mt-3 text-4xl font-black tracking-tight">A professional foundation for the full academy operating system.</h2>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {features.map((feature, index) => (
              <FeatureCard key={feature.title} {...feature} icon={featureIcons[index]} />
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white py-20">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 lg:grid-cols-2">
          <div>
            <p className="text-sm font-black uppercase tracking-widest text-directGold">How it works</p>
            <h2 className="mt-3 text-4xl font-black tracking-tight">Start with structure. Grow into full academy intelligence.</h2>
            <p className="mt-4 text-sm leading-6 text-slate-600">{SUPPORT_TEXT}</p>
          </div>
          <div className="grid gap-4">
            {['Add academy/coaches', 'Create batches and assign students', 'Track classes, reports, fees, and progress'].map((step, index) => (
              <div className="flex gap-4 rounded-2xl border border-slate-200 p-5 shadow-card" key={step}>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 font-black text-directBlue">{index + 1}</div>
                <div className="font-black text-navy">{step}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-slate-50 py-20">
        <div className="mx-auto max-w-7xl px-5">
          <div className="grid gap-5 md:grid-cols-3">
            {[
              ['Academy Owner', 'View the whole academy, batches, fees, reports, and coach allocation.'],
              ['Independent Coach', 'Manage students and batches without needing a large academy setup.'],
              ['Student/Parent', `Prepare for clean progress visibility and ${PLAY_APP_NAME} access.`],
            ].map(([title, description]) => (
              <div className="rounded-3xl bg-white p-6 shadow-card" key={title}>
                <h3 className="text-xl font-black text-navy">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-navy px-5 py-20 text-center text-white">
        <RoadmapBadge status="Future Integration" />
        <h2 className="mx-auto mt-5 max-w-3xl text-4xl font-black tracking-tight">Prepare your academy for a smarter chess learning system.</h2>
        <Link className="mt-8 inline-flex rounded-full bg-directGold px-6 py-3 text-sm font-black text-white" to="/dashboard">
          Open Phase 1 Dashboard
        </Link>
      </section>
    </main>
  );
}
