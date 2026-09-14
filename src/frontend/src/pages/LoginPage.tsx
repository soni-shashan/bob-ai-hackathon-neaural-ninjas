import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { loginUser } from '../services/api';
import { Shield, Zap, AlertTriangle, Eye, EyeOff, Loader2, Lock, Mail } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [retryCountdown, setRetryCountdown] = useState(0);

  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  // Retry countdown timer
  useEffect(() => {
    if (retryCountdown <= 0) {
      setIsRateLimited(false);
      return;
    }
    const timer = setTimeout(() => setRetryCountdown(retryCountdown - 1), 1000);
    return () => clearTimeout(timer);
  }, [retryCountdown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password.trim()) {
      setError('Please enter both email and password');
      return;
    }

    setIsLoading(true);

    try {
      const response = await loginUser(email.trim(), password);
      login(response.access_token, response.user_name, response.user_email);
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      const msg = err.message || 'Login failed';
      if (msg.includes('Too many')) {
        setIsRateLimited(true);
        // Extract retry seconds from message if possible
        const match = msg.match(/(\d+)\s*seconds/);
        setRetryCountdown(match ? parseInt(match[1]) : 60);
      }
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-page">
      {/* Animated Background Grid */}
      <div className="login-bg-grid" />
      <div className="login-bg-glow login-bg-glow--cyan" />
      <div className="login-bg-glow login-bg-glow--blue" />
      <div className="login-bg-glow login-bg-glow--purple" />

      {/* Floating Particles */}
      <div className="login-particles">
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className="login-particle"
            style={{
              left: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 8}s`,
              animationDuration: `${6 + Math.random() * 8}s`,
              width: `${2 + Math.random() * 3}px`,
              height: `${2 + Math.random() * 3}px`,
            }}
          />
        ))}
      </div>

      {/* Main Content */}
      <div className="login-container">
        {/* Brand Section */}
        <div className="login-brand">
          <div className="login-brand-icon">
            <Shield className="w-10 h-10 text-cyan-400" />
            <div className="login-brand-pulse" />
          </div>
          <h1 className="login-brand-title">
            <span className="text-cyan-400">Grid</span>
            <span className="text-slate-100">Guard</span>
            <span className="text-cyan-500 ml-2 text-lg font-normal">AI</span>
          </h1>
          <p className="login-brand-subtitle">
            Predictive Grid Resilience Platform
          </p>
        </div>

        {/* Login Card */}
        <div className="login-card">
          <div className="login-card-header">
            <div className="login-card-header-icon">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="login-card-title">Secure Access</h2>
              <p className="login-card-desc">Enter your credentials to continue</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="login-form">
            {/* Error Alert */}
            {error && (
              <div className={`login-alert ${isRateLimited ? 'login-alert--warning' : 'login-alert--error'}`}>
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">{error}</p>
                  {isRateLimited && retryCountdown > 0 && (
                    <p className="text-xs mt-1 opacity-80">
                      Retry in {retryCountdown}s
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Email Input */}
            <div className="login-field">
              <label htmlFor="login-email" className="login-label">
                Email Address
              </label>
              <div className="login-input-wrapper">
                <Mail className="login-input-icon" />
                <input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(''); }}
                  placeholder="you@example.com"
                  className="login-input"
                  autoComplete="email"
                  autoFocus
                  disabled={isLoading || isRateLimited}
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="login-field">
              <label htmlFor="login-password" className="login-label">
                Password
              </label>
              <div className="login-input-wrapper">
                <Lock className="login-input-icon" />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(''); }}
                  placeholder="••••••••"
                  className="login-input login-input--password"
                  autoComplete="current-password"
                  disabled={isLoading || isRateLimited}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="login-password-toggle"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading || isRateLimited}
              className="login-button"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Authenticating...</span>
                </>
              ) : isRateLimited ? (
                <>
                  <AlertTriangle className="w-5 h-5" />
                  <span>Rate Limited ({retryCountdown}s)</span>
                </>
              ) : (
                <>
                  <Zap className="w-5 h-5" />
                  <span>Sign In</span>
                </>
              )}
            </button>
          </form>

          {/* Security Footer */}
          <div className="login-security-footer">
            <Shield className="w-3.5 h-3.5" />
            <span>Protected by GridGuard Security Protocol</span>
          </div>
        </div>

        {/* Bottom Info */}
        <div className="login-footer-info">
          <div className="login-footer-stats">
            <div className="login-footer-stat">
              <Zap className="w-3.5 h-3.5 text-cyan-400" />
              <span>256-bit Encryption</span>
            </div>
            <div className="login-footer-divider" />
            <div className="login-footer-stat">
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
              <span>Rate Protected</span>
            </div>
            <div className="login-footer-divider" />
            <div className="login-footer-stat">
              <Lock className="w-3.5 h-3.5 text-violet-400" />
              <span>JWT Auth</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
