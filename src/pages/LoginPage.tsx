import { Link } from 'react-router-dom';
import { APP_NAME } from '../config/brand';
import { BrandMark } from '../components/ui/BrandMark';

export function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5 py-10">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 shadow-soft">
        <Link to="/"><BrandMark /></Link>
        <h1 className="mt-5 text-4xl font-black tracking-tight text-navy">Login to Direct</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">Authentication for {APP_NAME} will be connected in a future phase.</p>
        <form className="mt-7 grid gap-4">
          <label className="text-sm font-bold text-slate-700">
            Email
            <input className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-directBlue focus:ring-4 focus:ring-blue-100" type="email" placeholder="owner@academy.com" />
          </label>
          <label className="text-sm font-bold text-slate-700">
            Password
            <input className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-directBlue focus:ring-4 focus:ring-blue-100" type="password" placeholder="••••••••" />
          </label>
          <Link to="/dashboard" className="mt-2 rounded-2xl bg-directBlue px-4 py-3 text-center text-sm font-black text-white shadow-card">
            Login to Direct
          </Link>
        </form>
      </div>
    </main>
  );
}
