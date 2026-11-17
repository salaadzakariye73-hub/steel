import { useState, type FormEvent } from 'react';
import { Lock, Mail, ArrowRight, Globe, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

const DEMO_ACCOUNTS = [
  { role: 'ADMIN', email: 'admin@kaahprops.so', pass: 'KaahAdmin2026!', label: 'Admin' },
  { role: 'MANAGER', email: 'manager@kaahprops.so', pass: 'StaffPass2026!', label: 'Manager' },
  { role: 'ACCOUNTANT', email: 'accountant@kaahprops.so', pass: 'StaffPass2026!', label: 'Accountant' },
  { role: 'STOREKEEPER', email: 'storekeeper@kaahprops.so', pass: 'StaffPass2026!', label: 'Storekeeper' },
];

export function LoginPage() {
  const { login } = useAuth();
  const { lang, setLang, t } = useLanguage();
  const [email, setEmail] = useState('admin@kaahprops.so');
  const [password, setPassword] = useState('KaahAdmin2026!');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setSubmitting(false);
    }
  };

  const quickLogin = async (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setError('');
    setSubmitting(true);
    try {
      await login(demoEmail, demoPass);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Left Industrial Navy Panel */}
      <div className="hidden lg:flex lg:w-[46%] flex-col justify-between bg-[#0B1324] p-12 text-white">
        <div className="flex items-center gap-3.5">
          <img
            src="/src/assets/images/company_logo_mark_1794824457556.jpg"
            alt="Kaah Steel Props Emblem"
            referrerPolicy="no-referrer"
            className="h-11 w-11 rounded-lg bg-white object-cover p-0.5"
          />
          <div>
            <div className="font-display text-lg font-bold tracking-tight text-white">
              {t('brandName')}
            </div>
            <div className="text-xs text-slate-400">{t('brandSubtitle')}</div>
          </div>
        </div>

        <div className="max-w-md space-y-6">
          <h1 className="font-display text-3xl font-bold leading-tight tracking-tight text-white [text-wrap:balance]">
            {lang === 'so'
              ? 'Maamulka Kirada Tiirarka Birta & Qalabka Dhismaha.'
              : 'Precision Steel Prop Inventory, Daily Billing & Contract Control.'}
          </h1>
          <p className="text-sm leading-relaxed text-slate-300">
            {lang === 'so'
              ? 'La soco tirada saxda ah ee bakhaarka, soo celinta qayb-qaybta ah, qaansheegyada maalinlaha ah, iyo lacagaha macmiilka hal meel.'
              : 'Track yard availability in real time, process partial or final returns with period-accurate daily billing, and issue bilingual PDF invoices.'}
          </p>

          <div className="grid grid-cols-2 gap-4 border-t border-slate-800 pt-6 text-xs text-slate-300">
            <div>
              <div className="font-semibold text-amber-400">
                {lang === 'so' ? 'Xisaabinta Maalinlaha' : 'Period-Accurate Billing'}
              </div>
              <p className="mt-1 text-slate-400">
                {lang === 'so'
                  ? 'Qiimeyn toos ah oo ku saleysan tirada haysata maalmaha.'
                  : 'Pro-rata partial return settlements with zero inventory leakage.'}
              </p>
            </div>
            <div>
              <div className="font-semibold text-amber-400">
                {lang === 'so' ? 'Laba Luqadood' : 'English & Somali'}
              </div>
              <p className="mt-1 text-slate-400">
                {lang === 'so'
                  ? 'Qaansheegyo PDF ah iyo warbixino Excel ah oo buuxa.'
                  : 'Full bilingual operations, PDF receipts, and Excel financial exports.'}
              </p>
            </div>
          </div>
        </div>

        <div className="text-xs text-slate-500">
          Kaah Steel Props & Shoring · Mogadishu Industrial Yard
        </div>
      </div>

      {/* Right Login Form */}
      <div className="flex flex-1 flex-col justify-between p-6 sm:p-12">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 lg:hidden">
            <img
              src="/src/assets/images/company_logo_mark_1794824457556.jpg"
              alt="Kaah Steel Props"
              referrerPolicy="no-referrer"
              className="h-9 w-9 rounded-lg border border-slate-200 bg-white object-cover"
            />
            <span className="font-display text-base font-bold text-slate-900">{t('brandName')}</span>
          </div>

          <div className="ml-auto flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1">
            <Globe className="ml-2 h-3.5 w-3.5 text-slate-400" />
            <button
              type="button"
              onClick={() => setLang('en')}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                lang === 'en' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              English
            </button>
            <button
              type="button"
              onClick={() => setLang('so')}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                lang === 'so' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Soomaali
            </button>
          </div>
        </div>

        <div className="mx-auto w-full max-w-md">
          <h2 className="font-display text-2xl font-bold text-slate-900">{t('signInTitle')}</h2>
          <p className="mt-1.5 text-sm text-slate-500">{t('signInSubtitle')}</p>

          {error && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-700">{t('email')}</label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                  placeholder="name@kaahprops.so"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-700">{t('password')}</label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#0F172A] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-60"
            >
              <span>{submitting ? t('signingIn') : t('signIn')}</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          <div className="mt-8 border-t border-slate-200 pt-5">
            <div className="mb-3 flex items-center gap-2 text-xs font-medium text-slate-500">
              <ShieldCheck className="h-4 w-4 text-amber-600" />
              <span>{t('quickRoleAccess')}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.role}
                  type="button"
                  disabled={submitting}
                  onClick={() => quickLogin(acc.email, acc.pass)}
                  className="flex flex-col items-start rounded-lg border border-slate-200 bg-white px-3 py-2 text-left transition-colors hover:border-slate-400 hover:bg-slate-50"
                >
                  <span className="text-xs font-semibold text-slate-900">{acc.label}</span>
                  <span className="font-mono text-[11px] text-slate-500">{acc.email}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="text-center text-xs text-slate-400">
          Protected by JWT & Role-Based Access Control
        </div>
      </div>
    </div>
  );
}
