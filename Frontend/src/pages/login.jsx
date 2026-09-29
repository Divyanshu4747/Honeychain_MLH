import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import "../components/pages.css";

export default function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e) {
    e.preventDefault();

    setError("");

    if (!email || !password) {
      setError("Please enter your email and password.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    navigate("/dashboard");
  }

  return (
    <div className="page">

      {/* NAVBAR */}

      <nav className="page-navbar">

        <div className="page-logo">
          🐝 BlockBeez
        </div>

        <div className="page-nav-links">
          <Link to="/dashboard">Dashboard</Link>
          <Link to="/hives">My Hives</Link>
          <Link to="/harvest">Harvest</Link>
          <Link to="/ai-health">AI Health</Link>
          <Link to="/verify">Verify</Link>
        </div>

        <div className="page-profile">
          🔐
        </div>

      </nav>


      {/* LOGIN */}

      <main
        style={{
          minHeight: "calc(100vh - 72px)",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          padding: "40px 20px",
        }}
      >

        <div
          style={{
            width: "100%",
            maxWidth: "440px",
            background: "#ffffff",
            borderRadius: "18px",
            padding: "40px",
            boxShadow: "0 12px 40px rgba(0,0,0,0.08)",
            border: "1px solid #eee",
          }}
        >

          <div
            style={{
              textAlign: "center",
              marginBottom: "30px",
            }}
          >

            <div
              style={{
                fontSize: "48px",
                marginBottom: "10px",
              }}
            >
              🐝
            </div>

            <div className="page-eyebrow">
              BEEKEEPER PORTAL
            </div>

            <h1 style={{ marginBottom: "10px" }}>
              Welcome Back
            </h1>

            <p>
              Sign in to manage your BlockBeez
              hives and harvest records.
            </p>

          </div>


          <form onSubmit={handleLogin}>

            {/* EMAIL */}

            <div style={{ marginBottom: "18px" }}>

              <label
                style={{
                  display: "block",
                  marginBottom: "8px",
                  fontWeight: "600",
                }}
              >
                Email
              </label>

              <input
                type="email"
                value={email}
                onChange={(e) =>
                  setEmail(e.target.value)
                }
                placeholder="beekeeper@blockbeez.com"
                autoComplete="email"
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "13px 14px",
                  borderRadius: "10px",
                  border: "1px solid #d8d8d8",
                  fontSize: "15px",
                }}
              />

            </div>


            {/* PASSWORD */}

            <div style={{ marginBottom: "20px" }}>

              <label
                style={{
                  display: "block",
                  marginBottom: "8px",
                  fontWeight: "600",
                }}
              >
                Password
              </label>

              <input
                type="password"
                value={password}
                onChange={(e) =>
                  setPassword(e.target.value)
                }
                placeholder="Enter your password"
                autoComplete="current-password"
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "13px 14px",
                  borderRadius: "10px",
                  border: "1px solid #d8d8d8",
                  fontSize: "15px",
                }}
              />

            </div>


            {/* ERROR */}

            {error && (
              <div
                style={{
                  marginBottom: "18px",
                  padding: "12px 14px",
                  borderRadius: "10px",
                  background: "#fff1f0",
                  color: "#c62828",
                  fontSize: "14px",
                }}
              >
                {error}
              </div>
            )}


            {/* LOGIN BUTTON */}

            <button
              type="submit"
              className="primary-button"
              disabled={loading}
              style={{
                width: "100%",
                padding: "14px",
                cursor: loading
                  ? "not-allowed"
                  : "pointer",
              }}
            >
              {loading
                ? "Signing In..."
                : "Sign In →"}
            </button>

          </form>


          <div style={{ textAlign: "center", marginTop: "18px", fontSize: "13px" }}>
            New to BlockBeez? <Link to="/keeper/register" style={{ color: "#8b681d", fontWeight: 800 }}>Register as New Keeper</Link>
          </div>

          <div
            style={{
              marginTop: "25px",
              paddingTop: "20px",
              borderTop: "1px solid #eee",
              textAlign: "center",
              fontSize: "13px",
              color: "#777",
            }}
          >
            Secure authentication powered by Supabase
          </div>

        </div>

      </main>

    </div>
  );
}