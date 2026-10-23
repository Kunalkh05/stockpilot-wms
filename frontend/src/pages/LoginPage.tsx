import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { Button } from '../components/common/Button.js';
import { Role } from '../types/index.js';
import { Lock, Mail, ArrowRight, ShieldCheck, User, UserPlus, Eye, EyeOff, KeyRound, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

interface LoginPageProps {
  initialMode?: 'login' | 'register';
}

export const LoginPage: React.FC<LoginPageProps> = ({ initialMode }) => {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Tab mode: 'login' or 'register'
  const [mode, setMode] = useState<'login' | 'register'>(
    initialMode || (searchParams.get('mode') === 'register' ? 'register' : 'login')
  );

  useEffect(() => {
    if (initialMode) {
      setMode(initialMode);
    } else if (searchParams.get('mode') === 'register') {
      setMode('register');
    }
  }, [initialMode, searchParams]);

  // Login form state
  const [identifier, setIdentifier] = useState('admin');
  const [password, setPassword] = useState('StockPilot2026!');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoginLoading, setIsLoginLoading] = useState(false);

  // Registration form state
  const [regLoginId, setRegLoginId] = useState('');
  const [regFullName, setRegFullName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regRole, setRegRole] = useState<Role>('WAREHOUSE_MANAGER');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [isRegisterLoading, setIsRegisterLoading] = useState(false);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) {
      toast.error('Please enter your Login ID or email');
      return;
    }
    if (!password) {
      toast.error('Please enter your password');
      return;
    }

    setIsLoginLoading(true);
    try {
      await login(identifier.trim(), password);
      toast.success('Signed in successfully');
      navigate('/dashboard');
    } catch (err: any) {
      toast.error(err.message || 'Login failed. Please verify your credentials.');
    } finally {
      setIsLoginLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = regLoginId.trim();
    if (!cleanId || cleanId.length < 3) {
      toast.error('Login ID must be at least 3 characters');
      return;
    }
    if (!/^[a-zA-Z0-9_.-]+$/.test(cleanId)) {
      toast.error('Login ID can only contain letters, numbers, hyphens, dots, or underscores');
      return;
    }
    if (!regFullName.trim() || regFullName.trim().length < 2) {
      toast.error('Please enter your full name');
      return;
    }
    if (!regPassword || regPassword.length < 6) {
      toast.error('Password must be at least 6 characters long');
      return;
    }
    if (regPassword !== regConfirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setIsRegisterLoading(true);
    try {
      await register({
        loginId: cleanId,
        fullName: regFullName.trim(),
        email: regEmail.trim() || undefined,
        role: regRole,
        password: regPassword,
      });
      toast.success(`Account "@${cleanId}" created and authenticated!`);
      navigate('/dashboard');
    } catch (err: any) {
      toast.error(err.message || 'Registration failed');
    } finally {
      setIsRegisterLoading(false);
    }
  };

  const setDemoCredentials = (loginId: string) => {
    setIdentifier(loginId);
    setPassword('StockPilot2026!');
  };

  return (
    <div className="min-h-screen bg-surface-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-brand-500 text-white font-black text-xl shadow mb-3">
          SP
        </div>
        <h2 className="text-2xl font-bold text-surface-900 tracking-tight">StockPilot WMS</h2>
        <p className="text-xs text-surface-500 mt-1">Enterprise Operational Warehouse Platform</p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-7 px-6 shadow-sm border border-surface-200 rounded-lg sm:px-9">
          {/* Mode Switcher Tabs */}
          <div className="flex rounded-md bg-surface-100 p-1 mb-6 border border-surface-200">
            <button
              type="button"
              onClick={() => setMode('login')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded transition-all ${
                mode === 'login'
                  ? 'bg-white text-surface-900 shadow-sm'
                  : 'text-surface-600 hover:text-surface-900'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5 text-brand-600" />
              <span>Sign In</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('register')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded transition-all ${
                mode === 'register'
                  ? 'bg-white text-surface-900 shadow-sm'
                  : 'text-surface-600 hover:text-surface-900'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5 text-brand-600" />
              <span>Create Account</span>
            </button>
          </div>

          {mode === 'login' ? (
            /* --- SIGN IN FORM --- */
            <form className="space-y-4" onSubmit={handleLoginSubmit}>
              <div>
                <label className="block text-xs font-semibold text-surface-700 uppercase tracking-wider mb-1">
                  Login ID or Corporate Email
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-surface-400 absolute left-3 top-2.5 pointer-events-none" />
                  <input
                    type="text"
                    required
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck="false"
                    placeholder="e.g. admin or admin@stockpilot.io"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    className="w-full h-9 pl-9 pr-3 text-xs border border-surface-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500 text-surface-900 font-mono"
                  />
                </div>
                <p className="text-[11px] text-surface-400 mt-1">
                  Enter your assigned username, custom Login ID, or email address.
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-surface-700 uppercase tracking-wider">
                    Password
                  </label>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-surface-400 absolute left-3 top-2.5 pointer-events-none" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Enter password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full h-9 pl-9 pr-10 text-xs border border-surface-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500 text-surface-900"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    className="absolute right-2.5 top-2 text-surface-400 hover:text-surface-700 focus:outline-none"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full mt-2"
                isLoading={isLoginLoading}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Sign In to Warehouse
              </Button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => setMode('register')}
                  className="text-xs text-brand-600 hover:text-brand-700 font-medium"
                >
                  Need an account? <span className="underline">Create your own Login ID & Password</span>
                </button>
              </div>

              {/* Quick Demo Accounts */}
              <div className="mt-5 pt-4 border-t border-surface-200">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase font-mono text-surface-500 mb-2">
                  <ShieldCheck className="w-3.5 h-3.5 text-brand-600" />
                  <span>Select Demo Role to Fill</span>
                </div>
                <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setDemoCredentials('admin')}
                    className={`px-2 py-1.5 rounded border text-left font-mono truncate transition-colors ${
                      identifier === 'admin'
                        ? 'border-brand-500 bg-brand-50 text-brand-900 font-semibold'
                        : 'border-surface-200 bg-surface-50 hover:bg-surface-100 text-surface-700'
                    }`}
                  >
                    Admin (admin)
                  </button>
                  <button
                    type="button"
                    onClick={() => setDemoCredentials('manager')}
                    className={`px-2 py-1.5 rounded border text-left font-mono truncate transition-colors ${
                      identifier === 'manager'
                        ? 'border-brand-500 bg-brand-50 text-brand-900 font-semibold'
                        : 'border-surface-200 bg-surface-50 hover:bg-surface-100 text-surface-700'
                    }`}
                  >
                    Manager (manager)
                  </button>
                  <button
                    type="button"
                    onClick={() => setDemoCredentials('inventory')}
                    className={`px-2 py-1.5 rounded border text-left font-mono truncate transition-colors ${
                      identifier === 'inventory'
                        ? 'border-brand-500 bg-brand-50 text-brand-900 font-semibold'
                        : 'border-surface-200 bg-surface-50 hover:bg-surface-100 text-surface-700'
                    }`}
                  >
                    Inventory Lead (inventory)
                  </button>
                  <button
                    type="button"
                    onClick={() => setDemoCredentials('picker')}
                    className={`px-2 py-1.5 rounded border text-left font-mono truncate transition-colors ${
                      identifier === 'picker'
                        ? 'border-brand-500 bg-brand-50 text-brand-900 font-semibold'
                        : 'border-surface-200 bg-surface-50 hover:bg-surface-100 text-surface-700'
                    }`}
                  >
                    Picker (picker)
                  </button>
                  <button
                    type="button"
                    onClick={() => setDemoCredentials('receiving')}
                    className={`col-span-2 px-2 py-1.5 rounded border text-left font-mono truncate transition-colors ${
                      identifier === 'receiving'
                        ? 'border-brand-500 bg-brand-50 text-brand-900 font-semibold'
                        : 'border-surface-200 bg-surface-50 hover:bg-surface-100 text-surface-700'
                    }`}
                  >
                    Receiving Clerk (receiving)
                  </button>
                </div>
              </div>
            </form>
          ) : (
            /* --- CREATE ACCOUNT / REGISTER FORM --- */
            <form className="space-y-3.5" onSubmit={handleRegisterSubmit}>
              <div className="bg-brand-50 border border-brand-200 rounded-md p-2.5 mb-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-brand-800">
                  <CheckCircle2 className="w-4 h-4 text-brand-600 flex-shrink-0" />
                  <span>Create Your Warehouse Account</span>
                </div>
                <p className="text-[11px] text-brand-700 mt-0.5">
                  Set up a unique Login ID and password to access the StockPilot platform.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-surface-700 uppercase tracking-wider mb-1">
                  Choose Login ID / Username <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-surface-400 absolute left-3 top-2.5 pointer-events-none" />
                  <input
                    type="text"
                    required
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck="false"
                    placeholder="e.g. kunalkhande or operator01"
                    value={regLoginId}
                    onChange={(e) => setRegLoginId(e.target.value)}
                    className="w-full h-9 pl-9 pr-3 text-xs border border-surface-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500 text-surface-900 font-mono"
                  />
                </div>
                <p className="text-[10px] text-surface-500 mt-0.5">
                  3-30 characters: letters, numbers, hyphens, dots, underscores.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-surface-700 uppercase tracking-wider mb-1">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-surface-400 absolute left-3 top-2.5 pointer-events-none" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. Kunal Khande"
                    value={regFullName}
                    onChange={(e) => setRegFullName(e.target.value)}
                    className="w-full h-9 pl-9 pr-3 text-xs border border-surface-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500 text-surface-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-surface-700 uppercase tracking-wider mb-1">
                  Email Address <span className="text-surface-400 text-[10px] lowercase">(optional)</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-surface-400 absolute left-3 top-2.5 pointer-events-none" />
                  <input
                    type="email"
                    placeholder="e.g. kunal@company.com"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    className="w-full h-9 pl-9 pr-3 text-xs border border-surface-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500 text-surface-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-surface-700 uppercase tracking-wider mb-1">
                  Assigned Operational Role
                </label>
                <select
                  value={regRole}
                  onChange={(e) => setRegRole(e.target.value as Role)}
                  className="w-full h-9 px-3 text-xs border border-surface-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500 text-surface-900 bg-white"
                >
                  <option value="WAREHOUSE_MANAGER">Warehouse Manager (Full Operations)</option>
                  <option value="ADMIN">System Administrator</option>
                  <option value="INVENTORY_SPECIALIST">Inventory Specialist</option>
                  <option value="PICKER_PACKER">Picker / Packer</option>
                  <option value="RECEIVING_CLERK">Receiving Clerk</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-surface-700 uppercase tracking-wider mb-1">
                    Password <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-surface-400 absolute left-2.5 top-2.5 pointer-events-none" />
                    <input
                      type={showRegPassword ? 'text' : 'password'}
                      required
                      placeholder="Min 6 chars"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      className="w-full h-9 pl-8 pr-8 text-xs border border-surface-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500 text-surface-900"
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegPassword(!showRegPassword)}
                      tabIndex={-1}
                      className="absolute right-2 top-2 text-surface-400 hover:text-surface-700 focus:outline-none"
                    >
                      {showRegPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-surface-700 uppercase tracking-wider mb-1">
                    Confirm <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-surface-400 absolute left-2.5 top-2.5 pointer-events-none" />
                    <input
                      type={showRegPassword ? 'text' : 'password'}
                      required
                      placeholder="Repeat password"
                      value={regConfirmPassword}
                      onChange={(e) => setRegConfirmPassword(e.target.value)}
                      className="w-full h-9 pl-8 pr-2.5 text-xs border border-surface-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500 text-surface-900"
                    />
                  </div>
                </div>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full mt-2"
                isLoading={isRegisterLoading}
                leftIcon={<UserPlus className="w-4 h-4" />}
              >
                Create Account & Sign In
              </Button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className="text-xs text-surface-600 hover:text-surface-900 font-medium"
                >
                  Already have an account? <span className="text-brand-600 underline">Sign in</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
