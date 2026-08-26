// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { Shield, ShieldAlert, ShieldCheck, QrCode, Lock, Loader2, RefreshCcw } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useQueryClient } from '@tanstack/react-query';

export default function AdminSecurity() {
  const [loading, setLoading] = useState(true);
  // FIXED: Explicitly casting the array so the editor stops throwing the 'never[]' error
  const [factors, setFactors] = useState(/** @type {any[]} */ ([]));
  const [qrCode, setQrCode] = useState(/** @type {string | null} */ (null));
  const [secret, setSecret] = useState('');
  const [factorId, setFactorId] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState(/** @type {string | null} */ (null));

  useEffect(() => {
    loadFactors();
  }, []);

  const loadFactors = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;
      setFactors(data.totp || []);
    } catch (err) {
      console.error("Error loading MFA factors:", err);
    }
    setLoading(false);
  };

  const beginEnrollment = async () => {
    setLoading(true);
    setError(null);
    try {
      await supabase.rpc('log_admin_event', {
        p_action: 'SECURITY_UPDATE',
        p_table: 'auth.users',
        p_details: { event: 'Initiated 2FA Enrollment' }
      });

      const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
      if (error) throw error;
      
      setFactorId(data.id);
      setQrCode(data.totp.qr_code);
      setSecret(data.totp.secret);
    } catch (err) {
      setError(/** @type {Error} */ (err).message);
    }
    setLoading(false);
  };

  const completeEnrollment = async () => {
    if (!verifyCode || verifyCode.length < 6) {
      setError("Please enter the 6-digit code.");
      return;
    }
    
    setVerifying(true);
    setError(null);
    try {
      const challenge = await supabase.auth.mfa.challenge({ factorId });
      if (challenge.error) throw challenge.error;

      const verify = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.data.id,
        code: verifyCode
      });
      if (verify.error) throw verify.error;

      await supabase.rpc('log_admin_event', {
        p_action: 'SECURITY_UPDATE',
        p_table: 'auth.users',
        p_details: { event: 'Completed 2FA Enrollment' }
      });

      setQrCode(null);
      setVerifyCode('');
      await loadFactors();
    } catch (err) {
      setError("Verification failed. Please check your code and try again.");
    }
    setVerifying(false);
  };

  const unenroll = async (/** @type {string} */ id) => {
    if (!window.confirm("Are you absolutely sure you want to disable 2FA? This degrades your account security.")) return;
    
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId: id });
      if (error) throw error;
      
      await supabase.rpc('log_admin_event', {
        p_action: 'SECURITY_UPDATE',
        p_table: 'auth.users',
        p_details: { event: 'Disabled 2FA' }
      });

      await loadFactors();
    } catch (err) {
      alert("Failed to remove 2FA: " + /** @type {Error} */ (err).message);
    }
  };

  const isEnrolled = factors.filter((/** @type {any} */ f) => f.status === 'verified').length > 0;

  return (
    <div className="w-full max-w-4xl mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 uppercase tracking-wider">Account Security</h1>
        <p className="text-sm text-slate-500 mt-1">Manage Two-Factor Authentication (2FA) and access protocols.</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        
        <div className={`p-6 border-b flex items-center gap-4 ${isEnrolled ? 'bg-emerald-50 border-emerald-100' : 'bg-amber-50 border-amber-100'}`}>
          <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${isEnrolled ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
            {isEnrolled ? <ShieldCheck size={24} /> : <ShieldAlert size={24} />}
          </div>
          <div>
            <h2 className={`font-bold text-lg ${isEnrolled ? 'text-emerald-800' : 'text-amber-800'}`}>
              {isEnrolled ? 'Two-Factor Authentication is ENABLED' : 'Two-Factor Authentication is DISABLED'}
            </h2>
            <p className={`text-sm mt-0.5 ${isEnrolled ? 'text-emerald-600/80' : 'text-amber-700/80'}`}>
              {isEnrolled 
                ? 'Your admin account is protected by an authenticator app.' 
                : 'P0 Requirement: Admin accounts must be secured with 2FA to prevent unauthorized access.'}
            </p>
          </div>
        </div>

        <div className="p-8">
          {loading && !qrCode ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <Loader2 size={32} className="animate-spin mb-4" />
              <p>Checking security status...</p>
            </div>
          ) : qrCode ? (
            <div className="max-w-md mx-auto space-y-6 animate-in fade-in zoom-in-95">
              <div className="text-center">
                <h3 className="text-lg font-bold text-slate-900">Setup Authenticator App</h3>
                <p className="text-sm text-slate-500 mt-2">Scan this QR code with Google Authenticator, Authy, or your preferred TOTP app.</p>
              </div>
              
              <div className="bg-white p-4 border border-slate-200 rounded-xl flex justify-center shadow-sm">
                <img src={qrCode} alt="2FA QR Code" className="w-48 h-48" />
              </div>
              
              <div className="text-center">
                <p className="text-xs font-mono text-slate-400 mb-1">Manual Entry Code:</p>
                <code className="bg-slate-100 text-slate-800 px-3 py-1 rounded text-sm select-all">{secret}</code>
              </div>

              <div className="border-t border-slate-200 pt-6">
                <label className="block text-xs font-bold text-slate-700 uppercase mb-2">Enter 6-Digit Code</label>
                <input 
                  type="text" 
                  maxLength={6}
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000" 
                  className="w-full text-center tracking-[0.5em] font-mono text-xl border border-slate-300 rounded-lg p-3 outline-none focus:border-slate-900" 
                />
                {error && <p className="text-sm text-rose-600 font-medium mt-2 text-center">{error}</p>}
                
                <div className="flex gap-3 mt-6">
                  <button onClick={() => setQrCode(null)} className="flex-1 py-3 border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition-colors">Cancel</button>
                  <button onClick={completeEnrollment} disabled={verifying || verifyCode.length < 6} className="flex-1 py-3 bg-slate-900 text-white rounded-lg font-medium hover:bg-slate-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                    {verifying ? <Loader2 size={18} className="animate-spin"/> : <Lock size={18} />} Verify & Save
                  </button>
                </div>
              </div>
            </div>
          ) : isEnrolled ? (
            <div className="space-y-4">
              <h3 className="font-bold text-slate-900">Active Security Factors</h3>
              {factors.filter((/** @type {any} */ f) => f.status === 'verified').map((/** @type {any} */ factor) => (
                <div key={factor.id} className="flex items-center justify-between p-4 border border-slate-200 rounded-lg bg-slate-50">
                  <div className="flex items-center gap-3">
                    <QrCode size={20} className="text-slate-400" />
                    <div>
                      <p className="font-medium text-slate-900">Authenticator App</p>
                      <p className="text-xs text-slate-500">Added on {new Date(factor.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <button onClick={() => unenroll(factor.id)} className="text-sm font-medium text-rose-600 hover:text-rose-700 px-3 py-1.5 border border-rose-200 hover:bg-rose-50 rounded transition-colors">
                    Remove
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Shield size={48} className="mx-auto text-slate-300 mb-4" />
              <h3 className="text-lg font-bold text-slate-900 mb-2">Protect Your Admin Account</h3>
              <p className="text-sm text-slate-500 max-w-md mx-auto mb-8">Two-factor authentication adds an extra layer of security to your NOIR account by requiring a code from your mobile device when logging in.</p>
              <button onClick={beginEnrollment} className="bg-slate-900 text-white px-6 py-3 rounded-lg font-medium hover:bg-slate-800 transition-colors shadow-sm flex items-center gap-2 mx-auto">
                <Lock size={18} /> Enable 2FA Now
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}