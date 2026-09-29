import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Html5QrcodeScanner } from "html5-qrcode";
import { supabase } from "../supabase";
import "../components/pages.css";

export default function Verify() {
  const [batchId, setBatchId] = useState("");
  const [verified, setVerified] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [batches, setBatches] = useState({});
  const [loadingBatches, setLoadingBatches] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  // ==================================================
  // DEMO BATCHES
  // ==================================================

  const defaultBatches = {
    "BB-2026-091": {
      id: "BB-2026-091",
      hive: "HIVE-001",
      beekeeper: "BlockBeez Certified Beekeeper",
      location: "North Field",
      flora: "Mustard + Eucalyptus",
      honeyType: "Multiflora",
      harvestDate: "09 Sep 2026",
      harvestAmount: "4.2 kg",
      processingDate: "10 Sep 2026",
      labDate: "11 Sep 2026",
      moisture: "18.1%",
      purity: "98.9%",
      ph: "4.1",
      hmf: "12.6 mg/kg",
      labName: "BlockBeez Quality Lab",
      testStatus: "Passed",
      certificateUrl: "",
      hash: "Demo blockchain record",
      notes: "",
    },

    "BB-2026-092": {
      id: "BB-2026-092",
      hive: "HIVE-001",
      beekeeper: "BlockBeez Certified Beekeeper",
      location: "North Field",
      flora: "Mustard + Eucalyptus",
      honeyType: "Multiflora",
      harvestDate: "10 Sep 2026",
      harvestAmount: "4.7 kg",
      processingDate: "11 Sep 2026",
      labDate: "12 Sep 2026",
      moisture: "17.8%",
      purity: "99.2%",
      ph: "4.1",
      hmf: "12.6 mg/kg",
      labName: "BlockBeez Quality Lab",
      testStatus: "Passed",
      certificateUrl: "",
      hash: "Demo blockchain record",
      notes: "",
    },
  };

  // ==================================================
  // FORMAT DATE
  // ==================================================

  function formatDatabaseDate(dateValue) {
    if (!dateValue) return "Date not available";

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
      return String(dateValue);
    }

    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  // ==================================================
  // LOAD SUPABASE DATA
  // ==================================================

  useEffect(() => {
    async function loadHarvestBatches() {
      setLoadingBatches(true);
      setErrorMessage("");

      try {
        const {
          data: harvestData,
          error: harvestError,
        } = await supabase
          .from("harvest_batches")
          .select("*")
          .order("created_at", { ascending: true });

        if (harvestError) {
          console.error("Harvest fetch error:", harvestError);
        }

        const {
          data: labData,
          error: labError,
        } = await supabase
          .from("lab_quality")
          .select("*")
          .order("created_at", { ascending: true });

        if (labError) {
          console.error("Lab quality fetch error:", labError);
        }

        // Create lab lookup
        const qualityByBatch = {};

        if (labData && labData.length > 0) {
          labData.forEach((lab) => {
            qualityByBatch[lab.batch_id] = lab;
          });
        }

        // Start with demo records
        const databaseBatches = {
          ...defaultBatches,
        };

        // Add Supabase harvest records
        if (harvestData && harvestData.length > 0) {
          harvestData.forEach((harvest) => {
            const quality = qualityByBatch[harvest.batch_id];

            databaseBatches[harvest.batch_id] = {
              id: harvest.batch_id,
              hive: harvest.hive_code || "Unknown Hive",
              beekeeper: "BlockBeez Certified Beekeeper",
              location: "North Field",
              flora: "Mustard + Eucalyptus",
              honeyType: harvest.honey_type || "Honey",

              harvestDate: formatDatabaseDate(
                harvest.harvest_date
              ),

              harvestAmount:
                harvest.harvest_amount !== null &&
                harvest.harvest_amount !== undefined
                  ? `${harvest.harvest_amount} kg`
                  : "Amount unavailable",

              processingDate: "Processing pending",

              labDate: quality?.test_date
                ? formatDatabaseDate(quality.test_date)
                : "Laboratory testing pending",

              moisture:
                quality?.moisture !== null &&
                quality?.moisture !== undefined
                  ? `${quality.moisture}%`
                  : "Pending",

              purity:
                quality?.purity !== null &&
                quality?.purity !== undefined
                  ? `${quality.purity}%`
                  : "Pending",

              ph:
                quality?.ph !== null &&
                quality?.ph !== undefined
                  ? String(quality.ph)
                  : "Pending",

              hmf:
                quality?.hmf !== null &&
                quality?.hmf !== undefined
                  ? `${quality.hmf} mg/kg`
                  : "Pending",

              labName:
                quality?.lab_name ||
                "Laboratory testing pending",

              testStatus:
                quality?.test_status || "Pending",

              certificateUrl:
                quality?.certificate_url || "",

              hash: "Pending blockchain record",

              notes: harvest.notes || "",
            };
          });
        }

        // ==================================================
        // LOAD LOCAL STORAGE RECORDS
        // ==================================================

        let storedHarvests = [];

        try {
          storedHarvests = JSON.parse(
            localStorage.getItem("blockbeez_batches") || "[]"
          );
        } catch (storageError) {
          console.error(
            "Could not read localStorage:",
            storageError
          );
        }

        storedHarvests.forEach((harvest) => {
          if (!databaseBatches[harvest.id]) {
            const quality = qualityByBatch[harvest.id];

            databaseBatches[harvest.id] = {
              id: harvest.id,
              hive: harvest.hive || "Unknown Hive",
              beekeeper: "BlockBeez Certified Beekeeper",
              location: "North Field",
              flora: "Mustard + Eucalyptus",
              honeyType: harvest.type || "Honey",
              harvestDate: harvest.date || "Date unavailable",
              harvestAmount:
                harvest.amount !== undefined
                  ? `${harvest.amount} kg`
                  : "Amount unavailable",

              processingDate: "Processing pending",

              labDate: quality?.test_date
                ? formatDatabaseDate(quality.test_date)
                : "Laboratory testing pending",

              moisture:
                quality?.moisture !== null &&
                quality?.moisture !== undefined
                  ? `${quality.moisture}%`
                  : "Pending",

              purity:
                quality?.purity !== null &&
                quality?.purity !== undefined
                  ? `${quality.purity}%`
                  : "Pending",

              ph:
                quality?.ph !== null &&
                quality?.ph !== undefined
                  ? String(quality.ph)
                  : "Pending",

              hmf:
                quality?.hmf !== null &&
                quality?.hmf !== undefined
                  ? `${quality.hmf} mg/kg`
                  : "Pending",

              labName:
                quality?.lab_name ||
                "Laboratory testing pending",

              testStatus:
                quality?.test_status || "Pending",

              certificateUrl:
                quality?.certificate_url || "",

              hash: "Pending blockchain record",

              notes: harvest.notes || "",
            };
          }
        });

        setBatches(databaseBatches);
      } catch (error) {
        console.error(
          "Could not load BlockBeez batches:",
          error
        );

        setBatches(defaultBatches);
        setErrorMessage(
          "Live records could not be loaded. Showing demo verification records."
        );
      } finally {
        setLoadingBatches(false);
      }
    }

    loadHarvestBatches();
  }, []);

  // ==================================================
  // VERIFY BATCH
  // ==================================================

  function verifyBatch(idOverride = null) {
    if (loadingBatches) {
      alert("Please wait while BlockBeez loads batch records.");
      return;
    }

    const entered = (
      idOverride || batchId
    )
      .trim()
      .toUpperCase();

    // Empty input → latest demo batch
    if (!entered) {
      const latest =
        batches["BB-2026-092"] ||
        batches["BB-2026-091"];

      if (latest) {
        setBatchId(latest.id);
        setSelectedBatch(latest);
        setVerified(true);
        return;
      }

      return;
    }

    const foundBatch = batches[entered];

    if (!foundBatch) {
      setSelectedBatch(null);
      setVerified(false);

      alert(
        `Batch ${entered} was not found in BlockBeez.`
      );

      return;
    }

    setBatchId(foundBatch.id);
    setSelectedBatch(foundBatch);
    setVerified(true);
  }

  // ==================================================
  // QR DATA
  // ==================================================

  function extractBatchId(decodedText) {
    let scannedValue = decodedText.trim();

    try {
      const url = new URL(scannedValue);
      const urlBatchId =
        url.searchParams.get("batch");

      if (urlBatchId) {
        scannedValue = urlBatchId;
      }
    } catch {
      // Not a URL — use value directly
    }

    return scannedValue
      .trim()
      .toUpperCase();
  }

  // ==================================================
  // SIMULATE QR
  // ==================================================

  function simulateScan() {
    const demoBatch =
      batches["BB-2026-092"] ||
      batches["BB-2026-091"];

    if (!demoBatch) {
      alert("No demo batch is currently available.");
      return;
    }

    setBatchId(demoBatch.id);
    setSelectedBatch(demoBatch);
    setVerified(true);
  }

  // ==================================================
  // AUTOMATIC URL VERIFICATION
  // ==================================================

  useEffect(() => {
    if (loadingBatches) return;

    const params = new URLSearchParams(
      window.location.search
    );

    const urlBatchId = params.get("batch");

    if (!urlBatchId) return;

    const id = urlBatchId
      .trim()
      .toUpperCase();

    setBatchId(id);

    if (batches[id]) {
      setSelectedBatch(batches[id]);
      setVerified(true);
    } else {
      setSelectedBatch(null);
      setVerified(false);
      setErrorMessage(
        `Batch ${id} was not found in BlockBeez.`
      );
    }
  }, [loadingBatches, batches]);

  // ==================================================
  // QR CAMERA
  // ==================================================

  useEffect(() => {
    if (loadingBatches) return;

    const reader = document.getElementById("qr-reader");

    if (!reader) return;

    let scanner;

    try {
      scanner = new Html5QrcodeScanner(
        "qr-reader",
        {
          fps: 10,
          qrbox: {
            width: 250,
            height: 250,
          },
        },
        false
      );

      scanner.render(
        (decodedText) => {
          const scannedId =
            extractBatchId(decodedText);

          setBatchId(scannedId);

          if (batches[scannedId]) {
            setSelectedBatch(
              batches[scannedId]
            );
            setVerified(true);
            setErrorMessage("");
          } else {
            setSelectedBatch(null);
            setVerified(false);

            alert(
              "QR scanned successfully, but this batch is not registered in BlockBeez."
            );
          }

          scanner
            .clear()
            .catch(() => {});
        },
        () => {
          // Ignore continuous scanner errors
        }
      );
    } catch (error) {
      console.error(
        "QR scanner initialization error:",
        error
      );
    }

    return () => {
      if (scanner) {
        scanner.clear().catch(() => {});
      }
    };
  }, [loadingBatches, batches]);

  // ==================================================
  // LAB STATUS
  // ==================================================

  function getLabStatus(batch) {
    return batch?.testStatus || "Pending";
  }

  function getLabStatusSymbol(batch) {
    const status =
      getLabStatus(batch).toLowerCase();

    if (
      status === "passed" ||
      status === "pass"
    ) {
      return "✓";
    }

    if (
      status === "failed" ||
      status === "fail"
    ) {
      return "✕";
    }

    return "•";
  }

  function isLabPassed(batch) {
    const status =
      getLabStatus(batch).toLowerCase();

    return (
      status === "passed" ||
      status === "pass"
    );
  }

  // ==================================================
  // RENDER
  // ==================================================

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
          <Link to="/verify">Verify</Link>
        </div>

        <div className="page-profile">
          AG
        </div>
      </nav>

      {/* HEADER */}
      <header className="page-header">
        <div className="page-eyebrow">
          PUBLIC VERIFICATION
        </div>

        <h1>
          Verify Honey Batch
        </h1>

        <p>
          Scan or enter a BlockBeez batch ID
          to verify its journey from hive
          to table.
        </p>
      </header>

      {/* MAIN */}
      <main className="page-container">

        {/* SEARCH CARD */}
        <div className="verify-search-card">

          <div className="scanner-icon">
            ◉
          </div>

          <h2>
            Verify a Honey Batch
          </h2>

          <p>
            Scan the QR code attached to your
            honey batch or enter the batch ID
            manually.
          </p>

          {loadingBatches && (
            <p
              style={{
                textAlign: "center",
                fontWeight: "600",
              }}
            >
              Loading BlockBeez batch records...
            </p>
          )}

          {errorMessage && (
            <div
              style={{
                margin: "15px 0",
                padding: "12px 16px",
                borderRadius: "10px",
                background: "#fff8df",
                border: "1px solid #e7c85b",
                fontSize: "14px",
              }}
            >
              ⚠️ {errorMessage}
            </div>
          )}

          {/* MANUAL INPUT */}
          <div className="verify-input-row">

            <input
              type="text"
              value={batchId}
              onChange={(e) => {
                setBatchId(
                  e.target.value.toUpperCase()
                );
                setErrorMessage("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  verifyBatch();
                }
              }}
              placeholder="Enter Batch ID e.g. BB-2026-092"
              disabled={loadingBatches}
            />

            <button
              className="primary-button"
              onClick={() => verifyBatch()}
              disabled={loadingBatches}
            >
              Verify
            </button>

          </div>

          {/* QR CAMERA */}
          <div
            id="qr-reader"
            style={{
              width: "100%",
              maxWidth: "500px",
              margin: "20px auto",
            }}
          />

          {/* DEMO SCAN */}
          <button
            className="scan-button"
            onClick={simulateScan}
            disabled={loadingBatches}
          >
            📷 Simulate QR Scan
          </button>

          <p
            style={{
              textAlign: "center",
              fontSize: "12px",
              opacity: 0.65,
              marginTop: "12px",
            }}
          >
            Demo tip: use <strong>BB-2026-092</strong>
            for the fastest presentation.
          </p>

        </div>

        {/* ==================================================
            VERIFICATION RESULT
        ================================================== */}

        {verified && selectedBatch && (
          <div className="verification-result">

            {/* VERIFIED HEADER */}
            <div className="verified-header">

              <div className="verified-icon">
                ✓
              </div>

              <div>
                <div className="page-eyebrow">
                  BLOCKBEEZ VERIFIED
                </div>

                <h2>
                  Authentic Honey Batch
                </h2>

                <p>
                  Batch{" "}
                  <strong>
                    {selectedBatch.id}
                  </strong>{" "}
                  has a verified traceability record.
                </p>
              </div>

            </div>

            {/* BATCH SUMMARY */}
            <div className="verify-summary">

              <div>
                <span>Batch ID</span>
                <strong>
                  {selectedBatch.id}
                </strong>
              </div>

              <div>
                <span>Honey Type</span>
                <strong>
                  {selectedBatch.honeyType}
                </strong>
              </div>

              <div>
                <span>Harvest</span>
                <strong>
                  {selectedBatch.harvestAmount}
                </strong>
              </div>

              <div>
                <span>Hive</span>
                <strong>
                  {selectedBatch.hive}
                </strong>
              </div>

            </div>

            {/* TRACEABILITY */}
            <div className="traceability-card">

              <div className="page-eyebrow">
                HIVE-TO-TABLE TRACEABILITY
              </div>

              <h2>
                Complete Supply Chain
              </h2>

              <div className="timeline">

                {/* HIVE */}
                <div className="timeline-item">

                  <div className="timeline-dot">
                    1
                  </div>

                  <div className="timeline-content">

                    <span className="timeline-label">
                      HIVE ORIGIN
                    </span>

                    <h3>
                      {selectedBatch.hive}
                    </h3>

                    <p>
                      📍 {selectedBatch.location}
                    </p>

                    <p>
                      👤 {selectedBatch.beekeeper}
                    </p>

                    <p>
                      🌿 Nearby flora:{" "}
                      {selectedBatch.flora}
                    </p>

                  </div>

                  <div className="timeline-status">
                    ✓ Verified
                  </div>

                </div>

                {/* HARVEST */}
                <div className="timeline-item">

                  <div className="timeline-dot">
                    2
                  </div>

                  <div className="timeline-content">

                    <span className="timeline-label">
                      HARVEST
                    </span>

                    <h3>
                      {selectedBatch.harvestAmount}{" "}
                      Honey Harvested
                    </h3>

                    <p>
                      📅 {selectedBatch.harvestDate}
                    </p>

                    <p>
                      🍯 {selectedBatch.honeyType}
                    </p>

                    {selectedBatch.notes && (
                      <p>
                        📝 {selectedBatch.notes}
                      </p>
                    )}

                  </div>

                  <div className="timeline-status">
                    ✓ Recorded
                  </div>

                </div>

                {/* PROCESSING */}
                <div className="timeline-item">

                  <div className="timeline-dot">
                    3
                  </div>

                  <div className="timeline-content">

                    <span className="timeline-label">
                      PROCESSING
                    </span>

                    <h3>
                      Honey Processing
                    </h3>

                    <p>
                      📅{" "}
                      {selectedBatch.processingDate}
                    </p>

                    <p>
                      Batch handled through
                      verified processing workflow.
                    </p>

                  </div>

                  <div className="timeline-status">
                    {selectedBatch.processingDate ===
                    "Processing pending"
                      ? "• Pending"
                      : "✓ Verified"}
                  </div>

                </div>

                {/* LAB */}
                <div className="timeline-item">

                  <div className="timeline-dot">
                    4
                  </div>

                  <div className="timeline-content">

                    <span className="timeline-label">
                      LABORATORY
                    </span>

                    <h3>
                      Quality Testing
                    </h3>

                    <p>
                      📅 {selectedBatch.labDate}
                    </p>

                    <div className="lab-results">

                      <div>
                        <span>Moisture</span>
                        <strong>
                          {selectedBatch.moisture}
                        </strong>
                      </div>

                      <div>
                        <span>Purity</span>
                        <strong>
                          {selectedBatch.purity}
                        </strong>
                      </div>

                      <div>
                        <span>pH</span>
                        <strong>
                          {selectedBatch.ph}
                        </strong>
                      </div>

                      <div>
                        <span>HMF</span>
                        <strong>
                          {selectedBatch.hmf}
                        </strong>
                      </div>

                    </div>

                    {selectedBatch.labName &&
                      selectedBatch.labName !==
                        "Laboratory testing pending" && (
                        <p
                          style={{
                            marginTop: "12px",
                          }}
                        >
                          🧪 Lab:{" "}
                          {selectedBatch.labName}
                        </p>
                      )}

                  </div>

                  <div className="timeline-status">
                    {getLabStatusSymbol(
                      selectedBatch
                    )}{" "}
                    {getLabStatus(selectedBatch)}
                  </div>

                </div>

                {/* BLOCKCHAIN */}
                <div className="timeline-item last">

                  <div className="timeline-dot">
                    5
                  </div>

                  <div className="timeline-content">

                    <span className="timeline-label">
                      BLOCKCHAIN
                    </span>

                    <h3>
                      Immutable Verification
                    </h3>

                    <p>
                      This stage represents the
                      future blockchain anchoring
                      of the verified BlockBeez record.
                    </p>

                    <div className="hash-box">

                      <span>
                        Transaction Hash
                      </span>

                      <strong>
                        {selectedBatch.hash}
                      </strong>

                    </div>

                  </div>

                  <div className="timeline-status">
                    • Pending
                  </div>

                </div>

              </div>
            </div>

            {/* LAB CERTIFICATE */}
            {selectedBatch.certificateUrl && (
              <div
                className="trust-card"
                style={{
                  marginBottom: "20px",
                }}
              >
                <div className="trust-icon">
                  📄
                </div>

                <div>
                  <h3>
                    Laboratory Certificate
                  </h3>

                  <p>
                    The laboratory has attached
                    a certificate for this batch.
                  </p>

                  <a
                    href={
                      selectedBatch.certificateUrl
                    }
                    target="_blank"
                    rel="noreferrer"
                    className="primary-button"
                    style={{
                      display: "inline-block",
                      marginTop: "10px",
                      textDecoration: "none",
                    }}
                  >
                    View Certificate
                  </a>
                </div>
              </div>
            )}

            {/* FINAL TRUST CARD */}
            <div className="trust-card">

              <div className="trust-icon">
                🔐
              </div>

              <div>

                <h3>
                  Authenticity Confirmed
                </h3>

                <p>
                  The origin, harvest and
                  laboratory records associated
                  with this honey batch have been
                  successfully verified through
                  BlockBeez.
                </p>

                <div
                  style={{
                    marginTop: "12px",
                    fontSize: "13px",
                    fontWeight: "600",
                  }}
                >
                  {isLabPassed(selectedBatch)
                    ? "✓ Laboratory quality check passed"
                    : "• Laboratory quality check pending"}
                </div>

              </div>

            </div>

          </div>
        )}

      </main>
    </div>
  );
}