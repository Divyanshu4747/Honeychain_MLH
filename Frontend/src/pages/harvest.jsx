import { useState } from "react";
import { Link } from "react-router-dom";
import { QRCodeCanvas } from "qrcode.react";
import { supabase } from "../supabase";
import "../components/pages.css";

export default function Harvest() {
  const [hiveId, setHiveId] = useState("HIVE-001");
  const [preWeight, setPreWeight] = useState("");
  const [honeyType, setHoneyType] = useState("Multiflora");
  const [notes, setNotes] = useState("");
  const [savedBatch, setSavedBatch] = useState(null);
  const [showCertificate, setShowCertificate] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  // =========================================================
  // LOAD EXISTING BATCHES
  // =========================================================

  const [batches, setBatches] = useState(() => {
    const savedBatches = localStorage.getItem("blockbeez_batches");

    if (savedBatches) {
      try {
        const parsed = JSON.parse(savedBatches);

        // Remove duplicate batch IDs
        const uniqueBatches = parsed.filter(
          (batch, index, array) =>
            index ===
            array.findIndex(
              (item) => item.id === batch.id
            )
        );

        return uniqueBatches;
      } catch (error) {
        console.error("Could not read saved batches:", error);
      }
    }

    return [
      {
        id: "BB-2026-091",
        hive: "HIVE-001",
        type: "Multiflora",
        date: "09 Sep 2026",
        amount: 4.2,
        notes:
          "Initial harvest recorded from IoT-enabled hive.",
      },
    ];
  });

  // =========================================================
  // SIMULATED LIVE IoT WEIGHT
  // =========================================================

  const currentIoTWeight = 48.6;

  // =========================================================
  // VERIFICATION URL
  // =========================================================

  function getVerificationURL(batchId) {
    return `${window.location.origin}/verify?batch=${encodeURIComponent(
      batchId
    )}`;
  }

  // =========================================================
  // SAVE HARVEST
  // =========================================================

  async function saveHarvest() {
    if (saving) {
      return;
    }

    const before = Number(preWeight);

    // Validate Hive ID
    if (!hiveId.trim()) {
      alert("Please enter a Hive ID.");
      return;
    }

    // Validate pre-harvest weight
    if (!before || before <= currentIoTWeight) {
      alert(
        `Please enter a valid pre-harvest weight greater than ${currentIoTWeight} kg.`
      );
      return;
    }

    // Calculate harvested honey
    const harvestedAmount = Number(
      (before - currentIoTWeight).toFixed(2)
    );

    if (harvestedAmount <= 0) {
      alert("Harvest amount must be greater than 0 kg.");
      return;
    }

    // =======================================================
    // GENERATE NEXT BATCH ID
    // =======================================================

    const batchNumbers = batches
      .map((batch) => {
        const match = String(batch.id).match(
          /BB-2026-(\d+)/
        );

        return match ? Number(match[1]) : 0;
      })
      .filter((number) => number > 0);

    const highestBatchNumber =
      batchNumbers.length > 0
        ? Math.max(...batchNumbers)
        : 90;

    const newBatchNumber = highestBatchNumber + 1;

    const batchId = `BB-2026-${String(
      newBatchNumber
    ).padStart(3, "0")}`;

    // Display date
    const displayDate = new Date().toLocaleDateString(
      "en-GB",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }
    );

    // Database date
    const databaseDate = new Date()
      .toISOString()
      .split("T")[0];

    // =======================================================
    // CREATE LOCAL BATCH OBJECT
    // =======================================================

    const newBatch = {
      id: batchId,
      hive: hiveId.trim().toUpperCase(),
      type: honeyType,
      date: displayDate,
      amount: harvestedAmount,
      notes: notes.trim(),
    };

    try {
      setSaving(true);

      // =====================================================
      // GET LOGGED-IN USER
      // =====================================================

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        console.error(
          "Could not get logged-in user:",
          userError
        );

        alert(
          "You must be logged in to save a harvest."
        );

        return;
      }

      // =====================================================
      // SAVE TO SUPABASE
      // =====================================================

      const { error } = await supabase
        .from("harvest_batches")
        .insert([
          {
            batch_id: newBatch.id,
            hive_code: newBatch.hive,
            honey_type: newBatch.type,
            harvest_date: databaseDate,
            harvest_amount: newBatch.amount,
            notes: newBatch.notes || null,

            // Link harvest to logged-in beekeeper
            user_id: user.id,
          },
        ]);

      // Database error
      if (error) {
        console.error(
          "Supabase harvest insert error:",
          error
        );

        alert(
          `Harvest could not be saved to the database.\n\n${error.message}`
        );

        return;
      }

      // =====================================================
      // ADD TO PAGE
      // =====================================================

      setBatches((previousBatches) => {
        const updatedBatches = [
          newBatch,
          ...previousBatches.filter(
            (batch) => batch.id !== newBatch.id
          ),
        ];

        localStorage.setItem(
          "blockbeez_batches",
          JSON.stringify(updatedBatches)
        );

        return updatedBatches;
      });

      // Remember newly saved batch
      setSavedBatch(newBatch);

      // Reset form
      setPreWeight("");
      setNotes("");
      setShowForm(false);

      // =====================================================
      // SUCCESS MESSAGE
      // =====================================================

      alert(
        `Harvest saved successfully!\n\n${harvestedAmount} kg honey harvested.\n\nBatch ID: ${newBatch.id}\n\n✓ Saved to Supabase database`
      );
    } catch (error) {
      console.error(
        "Unexpected harvest save error:",
        error
      );

      alert(
        "Something went wrong while saving the harvest."
      );
    } finally {
      setSaving(false);
    }
  }

  // =========================================================
  // DOWNLOAD QR
  // =========================================================

  function downloadQR(batchId) {
    const canvas = document.querySelector(
      `[data-qr="${batchId}"] canvas`
    );

    if (!canvas) {
      alert("QR code not found.");
      return;
    }

    const link = document.createElement("a");

    link.download = `${batchId}-BlockBeez-QR.png`;
    link.href = canvas.toDataURL("image/png");

    link.click();
  }

  // =========================================================
  // PRINT CERTIFICATE
  // =========================================================

  function printCertificate() {
    window.print();
  }

  // =========================================================
  // PAGE
  // =========================================================

  return (
    <div className="page">

      {/* =====================================================
          NAVBAR
      ====================================================== */}

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


      {/* =====================================================
          MAIN PAGE
      ====================================================== */}

      <main className="page-container">

        {/* PAGE HEADER */}

        <header className="page-header">

          <div className="page-eyebrow">
            BATCH MANAGEMENT
          </div>

          <h1>Harvest Records</h1>

          <p className="page-description">
            Manage honey harvests recorded from your
            IoT-enabled hives.
          </p>

        </header>


        {/* ===================================================
            NEW HARVEST BUTTON
        ==================================================== */}

        <div className="harvest-button-area">

          <button
            className="primary-button"
            onClick={() => setShowForm(true)}
          >
            + Log New Harvest
          </button>

        </div>


        {/* ===================================================
            HIVE SUMMARY
        ==================================================== */}

        <div className="page-grid">

          <div className="info-card">
            <span>Hive ID</span>
            <strong>{hiveId}</strong>
          </div>

          <div className="info-card">
            <span>Honey Type</span>

            <strong>
              {batches.length > 0
                ? batches[0].type
                : "Multiflora"}
            </strong>
          </div>

          <div className="info-card">
            <span>Latest Harvest</span>

            <strong>
              {batches.length > 0
                ? `${batches[0].amount} kg`
                : "0 kg"}
            </strong>
          </div>

          <div className="info-card">
            <span>Status</span>
            <strong>✓ Verified</strong>
          </div>

        </div>


        {/* ===================================================
            RECENT ACTIVITY
        ==================================================== */}

        <section className="large-card">

          <div className="page-eyebrow">
            RECENT ACTIVITY
          </div>

          <h2>Recent Harvest Batches</h2>

          {batches.length === 0 ? (

            <p className="empty-state">
              No harvest batches recorded yet.
            </p>

          ) : (

            <div className="batch-list">

              {batches.map((batch) => (

                <div
                  className="batch-row"
                  key={batch.id}
                >

                  <div className="batch-info">

                    <strong>
                      {batch.id}
                    </strong>

                    <p>
                      {batch.hive} • {batch.type} •{" "}
                      {batch.date}
                    </p>

                  </div>

                  <strong className="batch-amount">
                    {batch.amount} kg
                  </strong>

                  {/* =================================================
                      QR SECTION
                  ================================================== */}

                  <div
                    style={{
                      marginTop: "16px",
                      padding: "12px",
                      background: "#fff",
                      borderRadius: "10px",
                      textAlign: "center",
                    }}
                  >

                    <div data-qr={batch.id}>

                      <QRCodeCanvas
                        value={getVerificationURL(
                          batch.id
                        )}
                        size={120}
                      />

                    </div>

                    <p
                      style={{
                        marginTop: "8px",
                        fontSize: "12px",
                        fontWeight: "600",
                      }}
                    >
                      Scan to Verify
                    </p>

                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() =>
                        downloadQR(batch.id)
                      }
                      style={{
                        marginTop: "8px",
                        fontSize: "12px",
                        padding: "8px 12px",
                      }}
                    >
                      ⬇ Download QR
                    </button>

                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => {
                        setSavedBatch(batch);
                        setShowCertificate(true);
                      }}
                      style={{
                        marginTop: "8px",
                        marginLeft: "6px",
                        fontSize: "12px",
                        padding: "8px 12px",
                      }}
                    >
                      📜 View Certificate
                    </button>

                  </div>

                </div>

              ))}

            </div>

          )}

        </section>

      </main>


      {/* =====================================================
          HARVEST MODAL
      ====================================================== */}

      {showForm && (

        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowForm(false);
            }
          }}
        >

          <div className="modal">

            {/* MODAL HEADER */}

            <div className="modal-header">

              <div>

                <div className="page-eyebrow">
                  HARVEST RECORD
                </div>

                <h2>
                  Log New Harvest
                </h2>

              </div>

              <button
                type="button"
                className="modal-close"
                onClick={() =>
                  setShowForm(false)
                }
                aria-label="Close"
              >
                ×
              </button>

            </div>


            {/* DESCRIPTION */}

            <p className="modal-description">
              Record the harvest using your IoT
              hive-weight data.
            </p>


            {/* =================================================
                HIVE ID
            ================================================== */}

            <div className="form-group">

              <label htmlFor="hiveId">
                Hive ID
              </label>

              <input
                id="hiveId"
                type="text"
                value={hiveId}
                onChange={(e) =>
                  setHiveId(e.target.value)
                }
                placeholder="Example: HIVE-001"
              />

            </div>


            {/* =================================================
                PRE-HARVEST WEIGHT
            ================================================== */}

            <div className="form-group">

              <label htmlFor="preWeight">
                Pre-Harvest Hive Weight (kg)
              </label>

              <input
                id="preWeight"
                type="number"
                step="0.01"
                min="0"
                value={preWeight}
                onChange={(e) =>
                  setPreWeight(e.target.value)
                }
                placeholder="Example: 52.54"
              />

            </div>


            {/* =================================================
                CURRENT IoT WEIGHT
            ================================================== */}

            <div className="form-group">

              <label>
                Current IoT Hive Weight
              </label>

              <div className="iot-weight">
                {currentIoTWeight} kg
              </div>

              <small className="iot-hint">
                Live weight detected by the IoT sensor
              </small>

            </div>


            {/* =================================================
                HONEY TYPE
            ================================================== */}

            <div className="form-group">

              <label htmlFor="honeyType">
                Honey Type
              </label>

              <select
                id="honeyType"
                value={honeyType}
                onChange={(e) =>
                  setHoneyType(e.target.value)
                }
              >

                <option value="Multiflora">
                  Multiflora
                </option>

                <option value="Eucalyptus">
                  Eucalyptus
                </option>

                <option value="Mustard">
                  Mustard
                </option>

                <option value="Acacia">
                  Acacia
                </option>

                <option value="Litchi">
                  Litchi
                </option>

              </select>

            </div>


            {/* =================================================
                NOTES
            ================================================== */}

            <div className="form-group">

              <label htmlFor="notes">
                Notes
              </label>

              <textarea
                id="notes"
                rows="4"
                value={notes}
                onChange={(e) =>
                  setNotes(e.target.value)
                }
                placeholder="Add harvest observations..."
              />

            </div>


            {/* =================================================
                BUTTONS
            ================================================== */}

            <div className="modal-actions">

              <button
                type="button"
                className="secondary-button"
                onClick={() =>
                  setShowForm(false)
                }
                disabled={saving}
              >
                Cancel
              </button>

              <button
                type="button"
                className="primary-button"
                onClick={saveHarvest}
                disabled={saving}
              >
                {saving
                  ? "Saving..."
                  : "Save Harvest"}
              </button>

            </div>

          </div>

        </div>

      )}


      {/* =====================================================
          CERTIFICATE POPUP
      ====================================================== */}

      {showCertificate && savedBatch && (

        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowCertificate(false);
            }
          }}
        >

          <div
            className="modal"
            style={{
              maxWidth: "520px",
              textAlign: "center",
            }}
          >

            {/* CERTIFICATE HEADER */}

            <div className="page-eyebrow">
              BLOCKBEEZ CERTIFICATE
            </div>

            <h2>
              Honey Batch Certificate
            </h2>

            <p className="modal-description">
              Official digital harvest record
            </p>


            {/* QR */}

            <div
              style={{
                background: "#fff",
                padding: "18px",
                display: "inline-block",
                borderRadius: "12px",
                margin: "10px auto 20px",
              }}
            >

              <QRCodeCanvas
                value={getVerificationURL(
                  savedBatch.id
                )}
                size={180}
              />

            </div>


            {/* CERTIFICATE DETAILS */}

            <div
              style={{
                textAlign: "left",
                borderTop: "1px solid #ddd",
                paddingTop: "16px",
              }}
            >

              <p>
                <strong>Batch ID:</strong>{" "}
                {savedBatch.id}
              </p>

              <p>
                <strong>Hive ID:</strong>{" "}
                {savedBatch.hive}
              </p>

              <p>
                <strong>Honey Type:</strong>{" "}
                {savedBatch.type}
              </p>

              <p>
                <strong>Harvest Date:</strong>{" "}
                {savedBatch.date}
              </p>

              <p>
                <strong>Quantity:</strong>{" "}
                {savedBatch.amount} kg
              </p>

              {savedBatch.notes && (
                <p>
                  <strong>Notes:</strong>{" "}
                  {savedBatch.notes}
                </p>
              )}

            </div>


            {/* VERIFIED MESSAGE */}

            <div
              style={{
                marginTop: "20px",
                padding: "12px",
                borderRadius: "10px",
                background: "#f4f7ed",
                fontWeight: "700",
              }}
            >
              ✓ BLOCKBEEZ BATCH RECORDED
            </div>


            {/* CERTIFICATE BUTTONS */}

            <div
              className="modal-actions"
              style={{
                justifyContent: "center",
                marginTop: "20px",
              }}
            >

              <button
                type="button"
                className="secondary-button"
                onClick={printCertificate}
              >
                🖨 Print
              </button>

              <button
                type="button"
                className="primary-button"
                onClick={() =>
                  setShowCertificate(false)
                }
              >
                Close
              </button>

            </div>

          </div>

        </div>

      )}

    </div>
  );
}