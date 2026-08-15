// @ts-nocheck
import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogIn, Mail, Lock, Loader2 } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import GoogleIcon from "@/components/GoogleIcon";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // 1. Detect Environment
  const hostname = window.location.hostname;
  const isAdminDomain = hostname.startsWith('admin.') || hostname === 'admin.localhost';
  const isLocalDev = hostname === 'localhost' || hostname === '127.0.0.1';
  
  // Refs for Telegram widget
  const telegramWrapperRef = useRef(null);
  const isTelegramInjected = useRef(false);

  const handleSubmit = async (/** @type {React.FormEvent} */ e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) throw signInError;
      
      window.location.href = "/";
    } catch (/** @type {any} */ err) {
      setError(err.message || "Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    try {
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/`,
        },
      });
    } catch (/** @type {any} */ err) {
      setError(err.message || "Failed to initialize Google login");
    }
  };

  // --- UPDATED BACKEND VERIFICATION FLOW ---
  const handleTelegramSuccess = async (/** @type {any} */ user) => {
    setLoading(true);
    setError("");
    
    try {
      // 1. Send Telegram payload to our secure Edge Function
      const { data, error: functionError } = await supabase.functions.invoke('telegram-auth', {
        body: { user }
      });

      if (functionError) throw functionError;
      if (data?.error) throw new Error(data.error);

      // 2. Edge function verified the hash and generated a secure, temporary session credential
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      if (signInError) throw signInError;
      
      // 3. Success! Redirect to homepage
      window.location.href = "/";
      
    } catch (err) {
      console.error("Telegram Auth Error:", err);
      setError(err.message || "Failed to authenticate with Telegram. Please try again.");
      setLoading(false);
    }
  };

  // Inject the official Telegram Login Widget (Production Only)
  useEffect(() => {
    window.onTelegramAuth = handleTelegramSuccess;

    if (!isAdminDomain && !isLocalDev && telegramWrapperRef.current && !isTelegramInjected.current) {
      isTelegramInjected.current = true;
      
      const script = document.createElement("script");
      script.src = "https://telegram.org/js/telegram-widget.js?22";
      script.setAttribute("data-telegram-login", import.meta.env.VITE_TELEGRAM_BOT_NAME || "YOUR_BOT_USERNAME"); 
      script.setAttribute("data-size", "large");
      script.setAttribute("data-radius", "4");
      script.setAttribute("data-request-access", "write");
      script.setAttribute("data-userpic", "false");
      script.setAttribute("data-onauth", "onTelegramAuth(user)");
      script.async = true;
      
      telegramWrapperRef.current.appendChild(script);
    }
  }, [isAdminDomain, isLocalDev]);

  return (
    <AuthLayout
      icon={LogIn}
      title="Welcome back"
      subtitle={isAdminDomain ? "Admin Portal Login" : "Log in to your account"}
      hideBackLink={isAdminDomain}
      footer={
        !isAdminDomain ? (
          <>
            Don't have an account?{" "}
            <Link to="/register" className="text-primary font-medium hover:underline">
              Create one
            </Link>
          </>
        ) : null
      }
    >
      {!isAdminDomain && (
        <div className="space-y-4 mb-6 flex flex-col items-center w-full">
          <Button
            variant="outline"
            className="w-full h-12 text-sm font-medium"
            onClick={handleGoogle}
            disabled={loading}
          >
            <GoogleIcon className="w-5 h-5 mr-2" />
            Continue with Google
          </Button>

          {isLocalDev ? (
            <div 
              className={`relative w-full h-12 overflow-hidden rounded-md border border-input bg-background transition-colors flex items-center justify-center text-sm font-medium ${loading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-accent hover:text-accent-foreground cursor-pointer'}`}
              onClick={() => {
                if (!loading) {
                  alert("Local Dev Mode: To test actual Telegram Login, you must run this via ngrok or production domain to bypass Telegram's CSP frame blocking.");
                }
              }}
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                <>
                  <svg className="w-5 h-5 mr-2 text-[#229ED9]" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.18-.357.223-.548.223l.188-2.85 5.18-4.686c.223-.195-.054-.285-.346-.111l-6.4 4.024-2.76-.86c-.6-.185-.615-.6.125-.89l10.736-4.133c.5-.186.945.115.825.912z"/>
                  </svg>
                  Continue with Telegram (Local)
                </>
              )}
            </div>
          ) : (
            <div className={`relative w-full h-12 overflow-hidden rounded-md border border-input bg-background transition-colors flex items-center justify-center ${loading ? 'opacity-50' : 'hover:bg-accent hover:text-accent-foreground cursor-pointer'}`}>
              <div className="absolute inset-0 flex items-center justify-center text-sm font-medium pointer-events-none">
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                  <>
                    <svg className="w-5 h-5 mr-2 text-[#229ED9]" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.18-.357.223-.548.223l.188-2.85 5.18-4.686c.223-.195-.054-.285-.346-.111l-6.4 4.024-2.76-.86c-.6-.185-.615-.6.125-.89l10.736-4.133c.5-.186.945.115.825.912z"/>
                    </svg>
                    Continue with Telegram
                  </>
                )}
              </div>
              
              {!loading && (
                <div className="absolute inset-0 z-50 flex items-center justify-center w-full h-full" style={{ opacity: 0.01 }}>
                  <div ref={telegramWrapperRef} className="flex items-center justify-center w-full h-full" style={{ transform: "scale(2.5)", transformOrigin: "center" }} />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      {isAdminDomain && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
              <Input
                id="email"
                type="email"
                autoComplete="email"
                autoFocus
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10 h-12"
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link to="/forgot-password" className="text-xs text-primary hover:underline">
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10 h-12"
                required
              />
            </div>
          </div>
          <Button type="submit" className="w-full h-12 font-medium" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Logging in...
              </>
            ) : (
              "Log in"
            )}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}