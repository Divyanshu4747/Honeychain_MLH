import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import {
  Activity,
  Droplets,
  Thermometer,
  Scale,
  Radio,
  Wifi,
  WifiOff,
  Upload,
  Leaf,
  ShieldCheck,
  Brain,
} from "lucide-react";

import "../App.css";

import { supabase } from "../supabase";

function SensorCard({ icon: Icon, title, value, unit, status }) {
  return (
    <div className="sensor-card">
      <div className="sensor-icon">
        <Icon size={22} />
      </div>

      <div>
        <p>{title}</p>

        <h2>
          {value} <span>{unit}</span>
        </h2>

        <small className="healthy">● {status}</small>
      </div>
    </div>
  );
}

function Dashboard() {
  const [temperature, setTemperature] = useState(34.2);
  const [humidity, setHumidity] = useState(61);
  const [frequency, setFrequency] = useState(247);
  const [weight, setWeight] = useState(48.6);

  const [online, setOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );

  const [queue, setQueue] = useState([]);
  const [harvests, setHarvests] = useState([]);
  const [loadingHarvests, setLoadingHarvests] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [hives, setHives] = useState([]);
  const [loadingProfile, setLoadingProfile] = useState(true);

  const [showHarvestForm, setShowHarvestForm] = useState(false);

  const [harvestForm, setHarvestForm] = useState({
    hiveId: "",
    preWeight: "",
    honeyType: "Multiflora",
    notes: "",
  });

  // --------------------------------------------------
  // INTERNET STATUS
  // --------------------------------------------------

  useEffect(() => {
    const updateOnline = () => setOnline(navigator.onLine);

    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);

    return () => {
      window.removeEventListener("online", updateOnline);
      window.removeEventListener("offline", updateOnline);
    };
  }, []);

  // --------------------------------------------------
  // SIMULATED LIVE IOT DATA
  // --------------------------------------------------

  useEffect(() => {
    const timer = setInterval(() => {
      setTemperature((prev) =>
        +(prev + (Math.random() - 0.5) * 0.4).toFixed(1)
      );

      setHumidity((prev) =>
        Math.max(
          45,
          Math.min(
            80,
            Math.round(prev + (Math.random() - 0.5) * 2)
          )
        )
      );

      setFrequency((prev) =>
        Math.round(prev + (Math.random() - 0.5) * 5)
      );

      setWeight((prev) =>
        +(prev + (Math.random() - 0.5) * 0.08).toFixed(2)
      );
    }, 2000);

    return () => clearInterval(timer);
  }, []);

  // --------------------------------------------------
  // LOAD CURRENT ACCOUNT + ITS WORKSPACE DATA
  // --------------------------------------------------

  useEffect(() => {
    let mounted = true;

    async function loadWorkspace() {
      setLoadingProfile(true);

      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      const user = authData?.user;

      if (authError || !user) {
        console.error("Dashboard auth fetch error:", authError);
        if (mounted) {
          setCurrentUser(null);
          setHives([]);
          setHarvests([]);
        }
        setLoadingProfile(false);
        return;
      }

      if (!mounted) return;
      setCurrentUser(user);

      const [{ data: hiveData, error: hiveError }, { data: harvestData, error: harvestError }] =
        await Promise.all([
          supabase
            .from("hives")
            .select("*")
            .eq("user_id", user.id)
            .order("id", { ascending: true }),
          supabase
            .from("harvest_batches")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false }),
        ]);

      if (hiveError) {
        console.error("Dashboard hive fetch error:", hiveError);
        setHives([]);
      } else {
        setHives(hiveData || []);
      }

      if (harvestError) {
        console.error("Dashboard harvest fetch error:", harvestError);
        setHarvests([]);
      } else {
        setHarvests(harvestData || []);
      }

      setLoadingProfile(false);
    }

    loadWorkspace();

    return () => {
      mounted = false;
    };
  }, []);

  // --------------------------------------------------
  // LOAD LOCAL OFFLINE QUEUE FOR THIS ACCOUNT ONLY
  // --------------------------------------------------

  useEffect(() => {
    if (!currentUser?.id) return;

    try {
      const key = `blockbeez_batches_${currentUser.id}`;
      const stored = JSON.parse(localStorage.getItem(key) || "[]");

      if (Array.isArray(stored)) {
        setQueue(
          stored.map((item, index) => ({
            id: item.id || index + 1,
            batch: item.id || item.batch || "Pending Batch",
            date: item.date || item.harvestDate || "Recent",
            weight: item.weight || (item.amount ? `${item.amount} kg` : "—"),
          }))
        );
      } else {
        setQueue([]);
      }
    } catch (error) {
      console.error("Could not load local harvest queue:", error);
      setQueue([]);
    }
  }, [currentUser?.id]);

  // --------------------------------------------------
  // HARVEST LOGGING
  // --------------------------------------------------

  const logHarvest = () => {
    setShowHarvestForm(true);
  };

  const submitHarvest = async (event) => {
    event.preventDefault();

    const preWeight = Number(harvestForm.preWeight);
    const currentWeight = Number(weight);

    if (!preWeight || preWeight <= currentWeight) {
      alert(
        "Pre-harvest weight must be greater than the current hive weight."
      );
      return;
    }

    const harvestedQuantity = (
      preWeight - currentWeight
    ).toFixed(2);

    const randomBatchNumber =
      Math.floor(Math.random() * 900) + 100;

    const batchId = `BB-${new Date().getFullYear()}-${randomBatchNumber}`;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const payload = {
      batch_id: batchId,
      hive_code: harvestForm.hiveId,
      honey_type: harvestForm.honeyType,
      harvest_date: new Date().toISOString(),
      harvest_amount: Number(harvestedQuantity),
      notes: harvestForm.notes,
      user_id: user?.id || null,
    };

    // Save to Supabase when online.
    if (online) {
      const { error } = await supabase
        .from("harvest_batches")
        .insert([payload]);

      if (error) {
        console.error("Harvest insert error:", error);

        // Keep a local copy if database save fails.
        const localBatch = {
          id: batchId,
          batch: batchId,
          date: new Date().toISOString(),
          harvestDate: new Date().toLocaleDateString("en-IN"),
          hive: harvestForm.hiveId,
          hiveId: harvestForm.hiveId,
          amount: harvestedQuantity,
          weight: `${harvestedQuantity} kg`,
          type: harvestForm.honeyType,
          honeyType: harvestForm.honeyType,
          notes: harvestForm.notes,
        };

        const storageKey = `blockbeez_batches_${user?.id || "anonymous"}`;
        const existing = JSON.parse(
          localStorage.getItem(storageKey) || "[]"
        );

        localStorage.setItem(
          storageKey,
          JSON.stringify([...existing, localBatch])
        );

        setQueue((prev) => [
          ...prev,
          {
            id: Date.now(),
            batch: batchId,
            date: new Date().toLocaleDateString("en-IN"),
            weight: `${harvestedQuantity} kg`,
          },
        ]);

        alert(
          `Harvest saved locally.\nEstimated honey: ${harvestedQuantity} kg`
        );
      } else {
        const newRecord = {
          ...payload,
          id: Date.now(),
        };

        setHarvests((prev) => [newRecord, ...prev]);

        alert(
          `Harvest recorded successfully!\nEstimated honey: ${harvestedQuantity} kg`
        );
      }
    } else {
      const localBatch = {
        id: batchId,
        batch: batchId,
        date: new Date().toISOString(),
        harvestDate: new Date().toLocaleDateString("en-IN"),
        hive: harvestForm.hiveId,
        hiveId: harvestForm.hiveId,
        amount: harvestedQuantity,
        weight: `${harvestedQuantity} kg`,
        type: harvestForm.honeyType,
        honeyType: harvestForm.honeyType,
        notes: harvestForm.notes,
      };

      const storageKey = `blockbeez_batches_${user?.id || "anonymous"}`;
      const existing = JSON.parse(
        localStorage.getItem(storageKey) || "[]"
      );

      localStorage.setItem(
        storageKey,
        JSON.stringify([...existing, localBatch])
      );

      setQueue((prev) => [
        ...prev,
        {
          id: Date.now(),
          batch: batchId,
          date: new Date().toLocaleDateString("en-IN"),
          weight: `${harvestedQuantity} kg`,
        },
      ]);

      alert(
        `Offline harvest saved.\nEstimated honey: ${harvestedQuantity} kg`
      );
    }

    setHarvestForm({
      hiveId: primaryHive?.id || "",
      preWeight: "",
      honeyType: primaryHive?.honey || "Multiflora",
      notes: "",
    });

    setShowHarvestForm(false);
  };

  // --------------------------------------------------
  // SYNC LOCAL QUEUE
  // --------------------------------------------------

  const syncQueue = async () => {
    if (!online) {
      alert("Internet connection is required to sync pending data.");
      return;
    }

    if (queue.length === 0) return;

    let syncedCount = 0;
    const remaining = [];

    const storageKey = `blockbeez_batches_${currentUser?.id || "anonymous"}`;

    for (const item of queue) {
      try {
        const stored = JSON.parse(
          localStorage.getItem(storageKey) || "[]"
        );

        const localRecord = stored.find(
          (record) =>
            record.id === item.batch ||
            record.batch === item.batch
        );

        if (!localRecord) {
          remaining.push(item);
          continue;
        }

        const {
          data: { user },
        } = await supabase.auth.getUser();

        const { error } = await supabase
          .from("harvest_batches")
          .insert([
            {
              batch_id: localRecord.id || localRecord.batch,
              hive_code:
                localRecord.hiveId ||
                localRecord.hive ||
                primaryHive?.id ||
                "UNASSIGNED",
              honey_type:
                localRecord.honeyType ||
                localRecord.type ||
                "Multiflora",
              harvest_date:
                localRecord.date || new Date().toISOString(),
              harvest_amount: Number(
                localRecord.amount ||
                  String(localRecord.weight || "")
                    .replace("kg", "")
                    .trim() ||
                  0
              ),
              notes: localRecord.notes || "",
              user_id: user?.id || null,
            },
          ]);

        if (error) {
          remaining.push(item);
        } else {
          syncedCount += 1;
        }
      } catch {
        remaining.push(item);
      }
    }

    setQueue(remaining);

    if (syncedCount > 0) {
      const stored = JSON.parse(
        localStorage.getItem(storageKey) || "[]"
      );

      const remainingIds = new Set(
        remaining.map((item) => item.batch)
      );

      const cleaned = stored.filter((item) =>
        remainingIds.has(item.id || item.batch)
      );

      localStorage.setItem(
        storageKey,
        JSON.stringify(cleaned)
      );

      const { data } = await supabase
        .from("harvest_batches")
        .select("*")
        .eq("user_id", currentUser?.id || "")
        .order("created_at", { ascending: false });

      setHarvests(data || []);
    }

    alert(
      syncedCount > 0
        ? `${syncedCount} pending harvest record(s) synced successfully.`
        : "No pending records could be synced."
    );
  };

  // --------------------------------------------------
  // DASHBOARD STATS
  // --------------------------------------------------

  const totalHarvest = harvests.reduce(
    (sum, item) => sum + Number(item.harvest_amount || 0),
    0
  );

  const displayName =
    currentUser?.user_metadata?.full_name ||
    currentUser?.email?.split("@")[0] ||
    "Keeper";

  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "BK";

  const hiveCount = hives.length;
  const connectedCount = hives.filter((hive) => Boolean(hive.iot_device_id || hive.device_id)).length;
  const healthyCount = hives.filter((hive) => (hive.status || "Healthy").toLowerCase() === "healthy").length;
  const primaryHive = hives[0];
  const primaryHoneyType = primaryHive?.honey || "Not set";
  const primaryLocation = primaryHive?.location || "Add your apiary location";
  const flora = primaryHive?.flora || "Register a hive to add flora details";

  const activeHiveWeight = primaryHive?.weight ?? weight;

  useEffect(() => {
    if (!primaryHive?.id) return;
    setHarvestForm((prev) => ({
      ...prev,
      hiveId: prev.hiveId || primaryHive.id,
      honeyType: prev.honeyType || primaryHive.honey || "Multiflora",
    }));
  }, [primaryHive?.id, primaryHive?.honey]);

  const recentHarvests = [...harvests]
    .sort(
      (a, b) =>
        new Date(b.created_at || b.harvest_date || 0) -
        new Date(a.created_at || a.harvest_date || 0)
    )
    .slice(0, 7);

  const chartValues =
    recentHarvests.length > 0
      ? recentHarvests.map((item) =>
          Number(item.harvest_amount || 0)
        )
      : [1.8, 2.1, 2.5, 2.9, 3.2, 3.7, 4.2];

  const maxChartValue = Math.max(
    ...chartValues,
    1
  );

  const chartPoints = chartValues.map((value, index) => {
    const x =
      chartValues.length === 1
        ? 365
        : 50 +
          (index * 630) /
            (chartValues.length - 1);

    const y =
      220 -
      (value / maxChartValue) * 170;

    return [x, y];
  });

  const chartPolyline = chartPoints
    .map(([x, y]) => `${x},${y}`)
    .join(" ");

  const chartDays =
    recentHarvests.length > 0
      ? recentHarvests
          .slice()
          .reverse()
          .map((item) => {
            const date = new Date(
              item.harvest_date ||
                item.created_at
            );

            return Number.isNaN(date.getTime())
              ? "—"
              : date.toLocaleDateString(
                  "en-IN",
                  {
                    day: "2-digit",
                    month: "short",
                  }
                );
          })
      : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  // --------------------------------------------------
  // RENDER
  // --------------------------------------------------

  return (
    <div className="app">

      {/* NAVBAR */}
      <nav className="navbar">

        <div className="logo">
          <span>🐝</span>
          BlockBeez
        </div>

        <div className="nav-links">
          <Link to="/dashboard">Dashboard</Link>
          <Link to="/harvest">Harvest</Link>
          <Link to="/hives">My Hives</Link>
          <Link to="/ai-health">AI Health</Link>
          <Link to="/verify">Verify</Link>
        </div>

        <div className="profile">

          <div className="avatar">
            {initials}
          </div>

          <div>
            <strong>{displayName}</strong>
            <small>Beekeeper</small>
          </div>

          <button
            type="button"
            onClick={async () => {
              await supabase.auth.signOut();
              window.location.href = "/login";
            }}
            style={{
              marginLeft: "15px",
              padding: "8px 12px",
              borderRadius: "8px",
              border: "1px solid #ddd",
              background: "#fff",
              cursor: "pointer",
              fontWeight: "600",
            }}
          >
            Logout
          </button>

        </div>
      </nav>

      <main>

        {/* HEADER */}
        <section className="welcome">

          <div>
            <p className="eyebrow">
              SMART APIARY
            </p>

            <h1>
              Good evening, {displayName} 👋
            </h1>

            <p>
              Here's what's happening inside
              your hives today.
            </p>
          </div>

          <div
            className={`connection ${
              online ? "online" : "offline"
            }`}
          >
            {online && connectedCount > 0 ? (
              <Wifi size={17} />
            ) : (
              <WifiOff size={17} />
            )}

            {!online
              ? "Offline Mode"
              : connectedCount > 0
              ? "IoT Connected"
              : "No Hive Connected"}
          </div>

        </section>

        {/* PROFILE */}
        <section className="beekeeper-profile">

          <div className="profile-main">

            <div className="big-avatar">
              {initials}
            </div>

            <div>
              <h3>{displayName}</h3>

              <p>
                📍 {primaryLocation}
              </p>

              <p>
                🌸 {flora}
              </p>
            </div>

          </div>

          <div className="profile-item">
            <span>Honey Type</span>
            <strong>{primaryHoneyType}</strong>
          </div>

          <div className="profile-item">
            <span>Hive Size</span>
            <strong>{hiveCount} {hiveCount === 1 ? "Hive" : "Hives"}</strong>
          </div>

          <div className="profile-item">
            <span>Healthy Hives</span>
            <strong>{healthyCount} / {hiveCount}</strong>
          </div>

        </section>

        {/* NEW ACCOUNT EMPTY WORKSPACE */}
        {!loadingProfile && hiveCount === 0 && (
          <section className="empty-workspace-card">
            <div>
              <p className="eyebrow">YOUR NEW APIARY</p>
              <h2>Your workspace is ready.</h2>
              <p>
                This account has no hives yet. Register your first hive to
                start building your own BlockBeez data, telemetry and harvest history.
              </p>
            </div>
            <Link to="/keeper/register-hive" className="solid-btn">
              Register Your First Hive →
            </Link>
          </section>
        )}

        {/* LIVE DATA */}
        <div className="section-heading">

          <div>
            <p className="eyebrow">
              LIVE MONITORING
            </p>

            <h2>Hive Health</h2>
          </div>

          <span className="live">
            <span></span> {hiveCount > 0 ? "LIVE" : "WAITING FOR HIVE"}
          </span>

        </div>

        <section className="sensor-grid">

          <SensorCard
            icon={Thermometer}
            title="Temperature"
            value={hiveCount > 0 ? temperature : "—"}
            unit={hiveCount > 0 ? "°C" : ""}
            status="Healthy"
          />

          <SensorCard
            icon={Droplets}
            title="Humidity"
            value={hiveCount > 0 ? humidity : "—"}
            unit={hiveCount > 0 ? "%" : ""}
            status="Healthy"
          />

          <SensorCard
            icon={Radio}
            title="Hive Frequency"
            value={hiveCount > 0 ? frequency : "—"}
            unit={hiveCount > 0 ? "Hz" : ""}
            status="Normal"
          />

          <SensorCard
            icon={Scale}
            title="Hive Weight"
            value={hiveCount > 0 ? activeHiveWeight : "—"}
            unit={hiveCount > 0 ? "kg" : ""}
            status="Stable"
          />

        </section>

        {/* AI HEALTH */}
        <section className="ai-card">

          <div className="ai-icon">
            <Brain size={27} />
          </div>

          <div className="ai-content">

            <div className="ai-title">

              <div>
                <p className="eyebrow">
                  AI ANALYSIS
                </p>

                <h2>
                  Hive condition is healthy
                </h2>
              </div>

              <div className="health-score">
                {hiveCount > 0 ? "94%" : "—"}
              </div>

            </div>

            <p>
              Current temperature, humidity,
              vibration frequency and hive weight
              are within the expected seasonal range.
              {hiveCount > 0
                ? "Your current hive telemetry is being evaluated against the configured healthy ranges."
                : "Register a hive to begin account-specific health analysis."}
            </p>

            <div className="ai-tags">
              <span>✓ Stable temperature</span>
              <span>✓ Good humidity</span>
              <span>✓ Normal activity</span>
              <span>
                ✓{" "}
                {harvests.length > 0
                  ? "Live harvest data"
                  : "Positive honey growth"}
              </span>
            </div>

          </div>
        </section>

        {/* CHART */}
        <section className="dashboard-grid">

          <div className="chart-card">

            <div className="card-header">

              <div>
                <p className="eyebrow">
                  {harvests.length > 0
                    ? "SUPABASE DATA"
                    : "AI TREND"}
                </p>

                <h2>
                  Weekly Honey Accumulation
                </h2>
              </div>

              <div className="trend">
                {harvests.length > 1
                  ? `${totalHarvest.toFixed(1)} kg`
                  : "+18.4%"}
              </div>

            </div>

            <div className="chart">

              <div className="simple-chart">

                <svg
                  viewBox="0 0 700 300"
                  preserveAspectRatio="none"
                  className="chart-svg"
                >

                  <line
                    x1="50"
                    y1="40"
                    x2="680"
                    y2="40"
                    className="chart-grid"
                  />

                  <line
                    x1="50"
                    y1="100"
                    x2="680"
                    y2="100"
                    className="chart-grid"
                  />

                  <line
                    x1="50"
                    y1="160"
                    x2="680"
                    y2="160"
                    className="chart-grid"
                  />

                  <line
                    x1="50"
                    y1="220"
                    x2="680"
                    y2="220"
                    className="chart-grid"
                  />

                  <polyline
                    points={chartPolyline}
                    className="chart-line"
                    fill="none"
                  />

                  {chartPoints.map(
                    ([cx, cy], index) => (
                      <circle
                        key={index}
                        cx={cx}
                        cy={cy}
                        r="5"
                        className="chart-dot"
                      />
                    )
                  )}

                </svg>

                <div className="chart-labels">
                  {chartDays.map(
                    (day, index) => (
                      <span key={index}>
                        {day}
                      </span>
                    )
                  )}
                </div>

              </div>

            </div>

          </div>

          {/* SEASONAL DATA */}
          <div className="season-card">

            <p className="eyebrow">
              SEASONAL BENCHMARK
            </p>

            <h2>
              Current vs Healthy
            </h2>

            <div className="benchmark">

              <div>
                <span>Temperature</span>

                <strong>
                  {temperature}°C
                </strong>

                <small>
                  Healthy: 30–36°C
                </small>
              </div>

              <div className="bar">
                <div
                  style={{
                    width: `${Math.min(
                      100,
                      Math.max(
                        0,
                        ((temperature - 20) /
                          25) *
                          100
                      )
                    )}%`,
                  }}
                ></div>
              </div>

            </div>

            <div className="benchmark">

              <div>
                <span>Humidity</span>

                <strong>
                  {humidity}%
                </strong>

                <small>
                  Healthy: 50–70%
                </small>
              </div>

              <div className="bar">
                <div
                  style={{
                    width: `${Math.min(
                      100,
                      Math.max(
                        0,
                        humidity
                      )
                    )}%`,
                  }}
                ></div>
              </div>

            </div>

            <div className="benchmark">

              <div>
                <span>Hive Weight</span>

                <strong>
                  {weight} kg
                </strong>

                <small>
                  Healthy: 42–52 kg
                </small>
              </div>

              <div className="bar">
                <div
                  style={{
                    width: `${Math.min(
                      100,
                      Math.max(
                        0,
                        ((Number(weight) - 35) /
                          25) *
                          100
                      )
                    )}%`,
                  }}
                ></div>
              </div>

            </div>

          </div>

        </section>

        {/* HARVEST */}
        <section className="harvest-section">

          <div className="harvest-header">

            <div>
              <p className="eyebrow">
                BATCH MANAGEMENT
              </p>

              <h2>
                Harvest Logging
              </h2>

              <p>
                Record your harvest and let the
                IoT system calculate the estimated
                honey quantity.
              </p>
            </div>

            <button
              className="primary-button"
              onClick={logHarvest}
            >
              <Upload size={18} />
              Log Harvest
            </button>

          </div>

          <div className="harvest-info">

            <div>
              <Scale size={22} />

              <div>
                <span>
                  Current Hive Weight
                </span>

                <strong>
                  {weight} kg
                </strong>
              </div>
            </div>

            <div>
              <Activity size={22} />

              <div>
                <span>
                  Total Recorded Harvest
                </span>

                <strong>
                  {totalHarvest.toFixed(2)} kg
                </strong>
              </div>
            </div>

            <div>
              <Leaf size={22} />

              <div>
                <span>
                  Honey Type
                </span>

                <strong>
                  Multiflora
                </strong>
              </div>
            </div>

          </div>

        </section>

        {/* RECENT HARVESTS */}
        <section className="queue-card">

          <div className="queue-header">

            <div>
              <p className="eyebrow">
                SUPABASE RECORDS
              </p>

              <h2>
                Recent Harvest Batches
              </h2>

              <p>
                Live harvest records stored in
                the BlockBeez database.
              </p>
            </div>

            <div className="queue-status">
              {loadingHarvests
                ? "Loading..."
                : `${harvests.length} Records`}
            </div>

          </div>

          {loadingHarvests ? (
            <div className="empty-queue">
              <Activity size={32} />
              <p>
                Loading harvest records...
              </p>
            </div>
          ) : harvests.length === 0 ? (
            <div className="empty-queue">
              <ShieldCheck size={32} />

              <p>
                No database harvest records yet.
              </p>
            </div>
          ) : (
            <>
              {harvests
                .slice(0, 5)
                .map((item) => (
                  <div
                    className="queue-item"
                    key={item.id || item.batch_id}
                  >

                    <div className="queue-warning">
                      ✓
                    </div>

                    <div className="queue-details">

                      <strong>
                        {item.batch_id}
                      </strong>

                      <span>
                        {item.honey_type || "Honey"} •{" "}
                        {item.hive_code || "Hive"} •{" "}
                        {item.harvest_amount} kg
                      </span>

                    </div>

                    <span className="waiting">
                      Saved
                    </span>

                  </div>
                ))}
            </>
          )}

        </section>

        {/* OFFLINE QUEUE */}
        <section className="queue-card">

          <div className="queue-header">

            <div>
              <p className="eyebrow">
                DATA SYNCHRONIZATION
              </p>

              <h2>
                Offline Data Queue
              </h2>

              <p>
                Harvest records are safely stored
                until internet connectivity returns.
              </p>
            </div>

            <div className="queue-status">
              {queue.length} Pending
            </div>

          </div>

          {queue.length === 0 ? (
            <div className="empty-queue">

              <ShieldCheck size={32} />

              <p>
                All data is synchronized.
              </p>

            </div>
          ) : (
            <>
              {queue.map((item) => (
                <div
                  className="queue-item"
                  key={item.id}
                >

                  <div className="queue-warning">
                    ⚠
                  </div>

                  <div className="queue-details">

                    <strong>
                      {item.batch}
                    </strong>

                    <span>
                      Harvest • {item.date} •{" "}
                      {item.weight}
                    </span>

                  </div>

                  <span className="waiting">
                    Waiting for sync
                  </span>

                </div>
              ))}

              <button
                className="sync-button"
                onClick={syncQueue}
                disabled={!online}
              >
                <Wifi size={17} />

                {online
                  ? "Sync Pending Data"
                  : "Waiting for Internet"}
              </button>
            </>
          )}

        </section>

      </main>

      {/* HARVEST MODAL */}
      {showHarvestForm && (
        <div className="harvest-modal-overlay">

          <div className="harvest-modal">

            <div className="harvest-modal-header">

              <div>
                <p className="eyebrow">
                  HARVEST RECORD
                </p>

                <h2>
                  Log Honey Harvest
                </h2>

                <p>
                  Record the harvest using your
                  IoT hive-weight data.
                </p>
              </div>

              <button
                type="button"
                className="modal-close"
                onClick={() =>
                  setShowHarvestForm(false)
                }
              >
                ×
              </button>

            </div>

            <form
              onSubmit={submitHarvest}
              className="harvest-form"
            >

              <label>
                Hive ID

                <input
                  type="text"
                  value={harvestForm.hiveId}
                  onChange={(e) =>
                    setHarvestForm({
                      ...harvestForm,
                      hiveId: e.target.value,
                    })
                  }
                  placeholder="HIVE-001"
                  required
                />
              </label>

              <label>
                Pre-Harvest Hive Weight (kg)

                <input
                  type="number"
                  step="0.01"
                  value={harvestForm.preWeight}
                  onChange={(e) =>
                    setHarvestForm({
                      ...harvestForm,
                      preWeight: e.target.value,
                    })
                  }
                  placeholder={`Example: ${(
                    Number(weight) + 4.2
                  ).toFixed(2)}`}
                  required
                />
              </label>

              <div className="iot-weight-box">
                <span>
                  Current IoT Hive Weight
                </span>

                <strong>
                  {weight} kg
                </strong>
              </div>

              {harvestForm.preWeight &&
                Number(harvestForm.preWeight) >
                  Number(weight) && (
                  <div className="estimated-honey">

                    <span>
                      Estimated Honey Harvest
                    </span>

                    <strong>
                      {(
                        Number(
                          harvestForm.preWeight
                        ) - Number(weight)
                      ).toFixed(2)}{" "}
                      kg
                    </strong>

                  </div>
                )}

              <label>
                Honey Type

                <select
                  value={harvestForm.honeyType}
                  onChange={(e) =>
                    setHarvestForm({
                      ...harvestForm,
                      honeyType: e.target.value,
                    })
                  }
                >
                  <option>Multiflora</option>
                  <option>Mustard</option>
                  <option>Eucalyptus</option>
                  <option>Wild Flora</option>
                  <option>Other</option>
                </select>
              </label>

              <label>
                Notes

                <textarea
                  value={harvestForm.notes}
                  onChange={(e) =>
                    setHarvestForm({
                      ...harvestForm,
                      notes: e.target.value,
                    })
                  }
                  placeholder="Add harvest observations..."
                  rows="3"
                />
              </label>

              <div className="harvest-form-actions">

                <button
                  type="button"
                  className="secondary-button"
                  onClick={() =>
                    setShowHarvestForm(false)
                  }
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="primary-button"
                >
                  Save Harvest
                </button>

              </div>

            </form>

          </div>
        </div>
      )}

      <footer>
        <p>
          🐝 BlockBeez • Smart Beekeeping &
          Traceability
        </p>

        <span>
          IoT • AI • Blockchain
        </span>
      </footer>

    </div>
  );
}

export default Dashboard;
