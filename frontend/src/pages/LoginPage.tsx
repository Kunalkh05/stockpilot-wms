import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { Button } from '../components/common/Button.js';
import { Lock, Mail, ArrowRight, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('admin@stockpilot.io');
  const [password, setPassword] = useState('StockPilot2026!');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await login(email, password);
      toast.success('Authenticated successfully');
      navigate('/dashboard');
    } catch (err: any) {
      toast.error(err.message || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const setDemoCredentials = (roleEmail: string) => {
    setEmail(roleEmail);
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

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-sm border border-surface-200 rounded-lg sm:px-10">
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block text-xs font-semibold text-surface-700 uppercase tracking-wider mb-1">
                Corporate Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-surface-400 absolute left-3 top-2.5 pointer-events-none" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-9 pl-9 pr-3 text-xs border border-surface-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500 text-surface-900"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-surface-700 uppercase tracking-wider mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-surface-400 absolute left-3 top-2.5 pointer-events-none" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-9 pl-9 pr-3 text-xs border border-surface-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500 text-surface-900"
                />
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full mt-2"
              isLoading={isLoading}
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Sign In to Warehouse
            </Button>
          </form>

          {/* Quick Demo Accounts */}
          <div className="mt-6 pt-5 border-t border-surface-200">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase font-mono text-surface-500 mb-2">
              <ShieldCheck className="w-3.5 h-3.5 text-brand-600" />
              <span>Select Demo Role to Fill</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5 text-[11px]">
              <button
                type="button"
                onClick={() => setDemoCredentials('admin@stockpilot.io')}
                className="px-2 py-1.5 rounded border border-surface-200 bg-surface-50 hover:bg-surface-100 text-left font-mono truncate"
              >
                Admin
              </button>
              <button
                type="button"
                onClick={() => setDemoCredentials('manager@stockpilot.io')}
                className="px-2 py-1.5 rounded border border-surface-200 bg-surface-50 hover:bg-surface-100 text-left font-mono truncate"
              >
                Manager
              </button>
              <button
                type="button"
                onClick={() => setDemoCredentials('inventory@stockpilot.io')}
                className="px-2 py-1.5 rounded border border-surface-200 bg-surface-50 hover:bg-surface-100 text-left font-mono truncate"
              >
                Inventory Lead
              </button>
              <button
                type="button"
                onClick={() => setDemoCredentials('picker@stockpilot.io')}
                className="px-2 py-1.5 rounded border border-surface-200 bg-surface-50 hover:bg-surface-100 text-left font-mono truncate"
              >
                Picker / Packer
              </button>
              <button
                type="button"
                onClick={() => setDemoCredentials('receiving@stockpilot.io')}
                className="col-span-2 px-2 py-1.5 rounded border border-surface-200 bg-surface-50 hover:bg-surface-100 text-left font-mono truncate"
              >
                Receiving Clerk
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
