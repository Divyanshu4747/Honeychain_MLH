import { Link } from "react-router-dom";
import { ArrowRight, Bot, CheckCircle2, Search, ShieldCheck } from "lucide-react";
import "./portal.css";

const products = [
  { batch:"BB-2026-100", type:"Multifloral Reserve", origin:"HIVE-001", amount:"8.4 kg", quality:"98.5% purity", price:"₹699", note:"Mustard + eucalyptus" },
  { batch:"BB-2026-091", type:"Multiflora Honey", origin:"HIVE-001", amount:"4.2 kg", quality:"98.9% purity", price:"₹599", note:"Seasonal field harvest" },
  { batch:"BB-2026-092", type:"Golden Meadow Honey", origin:"HIVE-001", amount:"4.7 kg", quality:"99.2% purity", price:"₹649", note:"Fresh September harvest" },
];

export default function BuyerCatalog(){ return <div className="buyer-shell"><nav className="buyer-nav"><Link className="brand" to="/"><span className="brand-mark">🐝</span>Block<span>Beez</span></Link><div><Link to="/verify">Verify</Link><Link to="/assistant">AI Assistant</Link><Link className="buyer-account" to="/buyer/login">Account</Link></div></nav><main className="catalog-main"><div className="catalog-hero"><div><span className="eyebrow-pill"><ShieldCheck size={14}/> VERIFIED HONEY MARKET</span><h1>Honey with a story you can follow.</h1><p>Every listed batch is connected to BlockBeez traceability data.</p></div><Link className="catalog-verify" to="/verify"><CheckCircle2 size={18}/> Verify a jar</Link></div><div className="catalog-tools"><div className="search-box"><Search size={18}/><input placeholder="Search honey, batch or origin…"/></div><span>3 verified batches</span></div><div className="product-grid">{products.map(p=><article className="product-card" key={p.batch}><div className="product-image"><span>🍯</span><b>✓ VERIFIED</b></div><div className="product-body"><div className="product-meta"><span>{p.type}</span><strong>{p.price}</strong></div><h3>{p.note}</h3><div className="product-facts"><span>🐝 {p.origin}</span><span>🧪 {p.quality}</span></div><Link to={`/verify?batch=${p.batch}`} className="product-link">Trace batch {p.batch}<ArrowRight size={16}/></Link></div></article>)}</div></main><Link className="assistant-fab" to="/assistant"><Bot size={19}/> Ask BlockBeez AI</Link></div> }
