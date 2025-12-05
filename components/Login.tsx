import React, { useState } from 'react';
import { Lock, Loader2, UserPlus, LogIn, Mail } from 'lucide-react';
import { supabase } from '../services/supabaseClient';

interface LoginProps {}

const Login: React.FC<LoginProps> = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMsg('');
    
    try {
      if (isSignUp) {
        // Handle Sign Up
        const { error, data } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        if (data.user && !data.session) {
           setSuccessMsg("Account created! Please check your email to confirm your registration.");
           // Don't switch back immediately so they can see the message
        } else if (data.session) {
           // Auto logged in (if email confirmation is off)
           window.location.reload(); 
        }
      } else {
        // Handle Sign In
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-sans">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-fade-in">
        <div className="bg-slate-900 p-8 text-center relative overflow-hidden">
          {/* Decorative circles */}
          <div className="absolute top-0 left-0 w-32 h-32 bg-white/5 rounded-full -translate-x-10 -translate-y-10 blur-xl"></div>
          <div className="absolute bottom-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full translate-x-10 translate-y-10 blur-xl"></div>
          
          <h1 className="text-2xl font-bold text-white tracking-wide uppercase mb-1 relative z-10">Great River</h1>
          <p className="text-sm text-slate-400 font-light relative z-10">Stock Management System</p>
        </div>

        <div className="p-8">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-slate-800">
              {isSignUp ? 'Create Account' : 'Welcome Back'}
            </h2>
            <p className="text-sm text-slate-500">
              {isSignUp ? 'Register to access the inventory system' : 'Enter your credentials to access your account'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-slate-900 placeholder-slate-400 transition-all outline-none"
                  placeholder="name@company.com"
                  required
                />
                <Mail className="absolute left-3 top-3.5 text-slate-400" size={18} />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
              <div className="relative">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-slate-900 placeholder-slate-400 transition-all outline-none"
                  placeholder="••••••••"
                  minLength={6}
                  required
                />
                <Lock className="absolute left-3 top-3.5 text-slate-400" size={18} />
              </div>
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg flex items-start gap-2 border border-red-100">
                <span>•</span>
                <span>{error}</span>
              </div>
            )}
            
            {successMsg && (
              <div className="bg-green-50 text-green-600 text-sm p-3 rounded-lg border border-green-100 text-center">
                {successMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className={`w-full text-white font-bold py-3 rounded-lg transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-70 disabled:shadow-none ${
                isSignUp 
                  ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/30' 
                  : 'bg-slate-900 hover:bg-slate-800 shadow-slate-900/30'
              }`}
            >
              {loading ? (
                  <Loader2 className="animate-spin" size={20} />
              ) : isSignUp ? (
                  <>Create Account <UserPlus size={18} /></>
              ) : (
                  <>Sign In <LogIn size={18} /></>
              )}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-100 text-center">
            <p className="text-sm text-slate-600">
              {isSignUp ? 'Already have an account?' : "Don't have an account?"}
              <button 
                onClick={() => { 
                  setIsSignUp(!isSignUp); 
                  setError(''); 
                  setSuccessMsg(''); 
                }}
                className="ml-2 font-bold text-blue-600 hover:text-blue-800 transition-colors"
              >
                {isSignUp ? 'Sign In' : 'Sign Up'}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;