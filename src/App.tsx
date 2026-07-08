import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import Catalog from './pages/Catalog';
import ProductDetail from './pages/ProductDetail';
import TryOn from './pages/TryOn';
import AnalysisResults from './pages/AnalysisResults';
import Atelier from './pages/Atelier';
import Manifeste from './pages/Manifeste';
import VirtualTryOn from './components/VirtualTryOn';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="catalog" element={<Catalog />} />
        <Route path="product/:id" element={<ProductDetail />} />
        <Route path="try-on" element={<TryOn />} />
        <Route path="analysis-results" element={<AnalysisResults />} />
        <Route path="atelier" element={<Atelier />} />
        <Route path="manifeste" element={<Manifeste />} />
        <Route path="virtual-try-on" element={<VirtualTryOn />} />
      </Route>
    </Routes>
  );
}

export default App;
