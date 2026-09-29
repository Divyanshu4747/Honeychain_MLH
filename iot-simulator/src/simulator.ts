import axios from 'axios';

const HIVES = ['HIVE-001', 'HIVE-002'];

setInterval(async () => {
  for (const hiveId of HIVES) {
    const payload = {
      hiveId,
      temperature: +(34.0 + Math.random() * 2).toFixed(1),
      humidity: +(55.0 + Math.random() * 5).toFixed(1),
      weight: +(35.0 + Math.random() * 0.5).toFixed(2),
      acoustics: Math.round(200 + Math.random() * 40),
    };
    console.log(`[IoT Telemetry] ${hiveId}: ${payload.temperature}°C, ${payload.humidity}%`);
  }
}, 5000);
