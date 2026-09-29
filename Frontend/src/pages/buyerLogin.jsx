import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Mail, ShieldCheck } from "lucide-react";
import { supabase } from "../supabase";
import "./portal.css";

export default function BuyerLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function sendOtp(e) {
    e.preventDefault(); setError(""); setMessage("");
    if (!email.trim()) return setError("Enter your email address.");
    setLoading(true);
    const { error: authError } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true } });
    setLoading(false);
    if (authError) return setError(authError.message);
    localStorage.setItem("blockbeez_role", "buyer");
    setOtpSent(true); setMessage("OTP sent. Check your email to continue.");
  }

  async function verifyOtp(e) {
    e.preventDefault(); setError(""); setLoading(true);
    const { error: authError } = await supabase.auth.verifyOtp({ email: email.trim(), token: otp.trim(), type: "email" });
    setLoading(false);
    if (authError) return setError(authError.message);
    localStorage.setItem("blockbeez_role", "buyer");
    navigate("/buyer/catalog");
  }

  return <div className="auth-shell buyer-auth"><Link className="back-home" to="/"><ArrowLeft size={17}/> Back to BlockBeez</Link><div className="auth-card">
    <div className="auth-symbol">🍯</div><span className="eyebrow-pill">BUYER EXPERIENCE</span><h1>Discover honey you can trust.</h1><p>Use a secure one-time password to access verified BlockBeez honey.</p>
    {!otpSent ? <form onSubmit={sendOtp}><label>Email address</label><div className="input-icon"><Mail size={18}/><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email"/></div><button className="solid-btn" disabled={loading}>{loading?"Sending OTP…":"Send OTP →"}</button></form> : <form onSubmit={verifyOtp}><label>6-digit OTP</label><input className="plain-input" value={otp} onChange={e=>setOtp(e.target.value)} placeholder="Enter OTP" inputMode="numeric"/><button className="solid-btn" disabled={loading}>{loading?"Verifying…":"Verify & continue →"}</button><button type="button" className="text-btn" onClick={()=>setOtpSent(false)}>Use another email</button></form>}
    {message && <div className="success-message">✓ {message}</div>}{error && <div className="error-message">{error}</div>}
    <div className="secure-note"><ShieldCheck size={16}/> Authentication is powered by Supabase.</div>
  </div></div>;
}
