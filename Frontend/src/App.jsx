import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, Link } from "react-router-dom";
import { Bot } from "lucide-react";
import "./App.css";
import "./pages/portal.css";
import Landing from "./pages/landing.jsx";
import Login from "./pages/login.jsx";
import Dashboard from "./pages/dashboard.jsx";
import Harvest from "./pages/harvest.jsx";
import Hives from "./pages/hives.jsx";
import Verify from "./pages/verify.jsx";
import BuyerLogin from "./pages/buyerLogin.jsx";
import BuyerCatalog from "./pages/buyerCatalog.jsx";
import KeeperRegister from "./pages/keeperRegister.jsx";
import HiveHealth from "./pages/hiveHealth.jsx";
import HiveRegister from "./pages/hiveRegister.jsx";
import Assistant from "./pages/assistant.jsx";
import { supabase } from "./supabase";

function ProtectedRoute({ children }) { const [session,setSession]=useState(null); const [loading,setLoading]=useState(true); useEffect(()=>{let mounted=true; supabase.auth.getSession().then(({data})=>{if(mounted){setSession(data.session);setLoading(false)}}); const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,s)=>{setSession(s);setLoading(false)}); return()=>{mounted=false;subscription.unsubscribe()};},[]); if(loading)return <div className="route-loading">Loading BlockBeez…</div>; return session?children:<Navigate to="/login" replace/> }
function BuyerRoute({children}){const [session,setSession]=useState(null);const [loading,setLoading]=useState(true);useEffect(()=>{supabase.auth.getSession().then(({data})=>{setSession(data.session);setLoading(false)});const {data:{subscription}}=supabase.auth.onAuthStateChange((_e,s)=>setSession(s));return()=>subscription.unsubscribe()},[]);if(loading)return <div className="route-loading">Loading Buyer Experience…</div>;return session?children:<Navigate to="/buyer/login" replace/>}
function GlobalAssistant(){return <Link className="global-ai-button" to="/assistant"><Bot size={18}/><span>AI Assistant</span></Link>}
export default function App(){return <BrowserRouter><Routes><Route path="/" element={<Landing/>}/><Route path="/verify" element={<Verify/>}/><Route path="/assistant" element={<Assistant/>}/><Route path="/login" element={<Login/>}/><Route path="/buyer/login" element={<BuyerLogin/>}/><Route path="/buyer/catalog" element={<BuyerRoute><BuyerCatalog/></BuyerRoute>}/><Route path="/keeper/register" element={<KeeperRegister/>}/><Route path="/dashboard" element={<ProtectedRoute><Dashboard/></ProtectedRoute>}/><Route path="/ai-health" element={<ProtectedRoute><HiveHealth/></ProtectedRoute>}/><Route path="/keeper/register-hive" element={<ProtectedRoute><HiveRegister/></ProtectedRoute>}/><Route path="/harvest" element={<ProtectedRoute><DashboardRedirect target="harvest"/></ProtectedRoute>}/><Route path="/hives" element={<ProtectedRoute><DashboardRedirect target="hives"/></ProtectedRoute>}/><Route path="*" element={<Navigate to="/" replace/>}/></Routes><GlobalAssistant/></BrowserRouter>}
function DashboardRedirect({target}){return target==="harvest"?<Harvest/>:<Hives/>}
