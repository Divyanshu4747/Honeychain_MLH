import React from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';

export default function App() {
  return (
    <BrowserRouter>
      <div className="p-8 font-sans">
        <h1 className="text-3xl font-bold text-amber-600">HoneyChain KVIC Prototype</h1>
        <p className="mt-2 text-gray-700">Decentralized Honey Provenance & Hive Monitoring Platform</p>
      </div>
    </BrowserRouter>
  );
}
