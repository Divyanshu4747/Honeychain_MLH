import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../supabase";
import "../components/pages.css";

export default function Hives() {
  const [hives, setHives] = useState([]);
  const [loading, setLoading] = useState(true);

  // ==================================================
  // LOAD HIVES FOR LOGGED-IN USER
  // ==================================================

  useEffect(() => {
    async function loadHives() {
      setLoading(true);

      // Get currently logged-in user
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        console.error(
          "Could not get logged-in user:",
          userError
        );

        setHives([]);
        setLoading(false);
        return;
      }

      // Load only this user's hives
      const { data, error } = await supabase
        .from("hives")
        .select("*")
        .eq("user_id", user.id)
        .order("id", { ascending: true });

      if (error) {
        console.error(
          "Supabase hives error:",
          error
        );

        alert(
          `Could not load hive records.\n\n${error.message}`
        );

        setHives([]);
      } else {
        setHives(data || []);
      }

      setLoading(false);
    }

    loadHives();
  }, []);

  // ==================================================
  // SUMMARY COUNTS
  // ==================================================

  const totalHives = hives.length;

  const healthyHives = hives.filter(
    (hive) => hive.status === "Healthy"
  ).length;

  const attentionHives = hives.filter(
    (hive) => hive.status === "Attention"
  ).length;

  const connectedHives = hives.length;

  return (
    <div className="page">

      {/* NAVBAR */}

      <nav className="page-navbar">

        <div className="page-logo">
          🐝 BlockBeez
        </div>

        <div className="page-nav-links">
          <Link to="/dashboard">Dashboard</Link>
          <Link to="/harvest">Harvest</Link>
          <Link to="/hives">My Hives</Link>
          <Link to="/ai-health">AI Health</Link>
          <Link to="/verify">Verify</Link>
        </div>

        <div className="page-profile">
          AG
        </div>

      </nav>


      {/* HEADER */}

      <header className="page-header">

        <div className="page-eyebrow">
          HIVE MANAGEMENT
        </div>

        <h1>My Hives</h1>

        <p>
          Monitor the health and live IoT data of all your
          connected hives.
        </p>

        <Link
          to="/keeper/register-hive"
          className="hive-register-link"
        >
          + Register New Hive
        </Link>

      </header>


      {/* MAIN */}

      <main className="page-container">

        {/* TOP SUMMARY */}

        <div className="hives-summary">

          <div className="hive-summary-card">
            <span>Total Hives</span>

            <strong>
              {loading
                ? "—"
                : String(totalHives).padStart(2, "0")}
            </strong>
          </div>


          <div className="hive-summary-card">
            <span>Healthy</span>

            <strong>
              {loading
                ? "—"
                : String(healthyHives).padStart(2, "0")}
            </strong>
          </div>


          <div className="hive-summary-card">
            <span>Attention</span>

            <strong>
              {loading
                ? "—"
                : String(attentionHives).padStart(2, "0")}
            </strong>
          </div>


          <div className="hive-summary-card">
            <span>Connected</span>

            <strong>
              {loading
                ? "—"
                : connectedHives > 0
                ? "100%"
                : "0%"}
            </strong>
          </div>

        </div>


        {/* LOADING */}

        {loading && (
          <div
            style={{
              textAlign: "center",
              padding: "40px",
            }}
          >
            Loading hive records...
          </div>
        )}


        {/* NO HIVES */}

        {!loading && hives.length === 0 && (
          <div
            style={{
              textAlign: "center",
              padding: "40px",
            }}
          >
            No hive records found.
          </div>
        )}


        {/* HIVE CARDS */}

        {!loading && hives.length > 0 && (
          <div className="hives-list">

            {hives.map((hive) => (

              <div
                className="hive-card"
                key={hive.id}
              >

                {/* CARD TOP */}

                <div className="hive-card-top">

                  <div>

                    <div className="hive-id">
                      {hive.id}
                    </div>

                    <div className="hive-location">
                      📍 {hive.location}
                    </div>

                  </div>


                  <div
                    className={
                      hive.status === "Healthy"
                        ? "hive-status healthy"
                        : "hive-status attention"
                    }
                  >
                    ● {hive.status}
                  </div>

                </div>


                {/* HEALTH */}

                <div className="hive-health">

                  <div className="health-heading">

                    <span>
                      Hive Health
                    </span>

                    <strong>
                      {hive.health}%
                    </strong>

                  </div>


                  <div className="health-bar">

                    <div
                      className="health-progress"
                      style={{
                        width: `${hive.health}%`,
                      }}
                    />

                  </div>

                </div>


                {/* SENSOR DATA */}

                <div className="hive-sensors">

                  <div className="hive-sensor">

                    <span>
                      ⚖ Weight
                    </span>

                    <strong>
                      {hive.weight} kg
                    </strong>

                  </div>


                  <div className="hive-sensor">

                    <span>
                      🌡 Temperature
                    </span>

                    <strong>
                      {hive.temperature}°C
                    </strong>

                  </div>


                  <div className="hive-sensor">

                    <span>
                      💧 Humidity
                    </span>

                    <strong>
                      {hive.humidity}%
                    </strong>

                  </div>

                </div>


                {/* HIVE DETAILS */}

                <div className="hive-details">

                  <div>

                    <span>
                      Honey Type
                    </span>

                    <strong>
                      {hive.honey}
                    </strong>

                  </div>


                  <div>

                    <span>
                      Nearby Flora
                    </span>

                    <strong>
                      {hive.flora}
                    </strong>

                  </div>

                </div>


                {/* FOOTER */}

                <div className="hive-card-footer">

                  <span>
                    ● IoT Connected
                  </span>

                  <button type="button">
                    View Details →
                  </button>

                </div>

              </div>

            ))}

          </div>
        )}

      </main>

    </div>
  );
}