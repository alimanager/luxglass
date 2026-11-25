import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import Catalog from './pages/Catalog';
import ProductDetail from './pages/ProductDetail';
import AnalysisResults from './pages/AnalysisResults';

// Heavy routes (TensorFlow.js) are split out of the main bundle.
const TryOn = lazy(() => import('./pages/TryOn'));
const Essayer = lazy(() => import('./pages/Essayer'));
const Labo = lazy(() => import('./pages/Labo'));
const Apercu = lazy(() => import('./pages/Apercu'));
const Formes = lazy(() => import('./pages/Formes'));

const Loading = () => <div className="min-h-[60vh]" />;
const OldProduct = () => <Navigate to={`/montures/${useParams().id}`} replace />;

export default function App() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="montures" element={<Catalog />} />
          <Route path="montures/:id" element={<ProductDetail />} />
          <Route path="analyse" element={<TryOn />} />
          <Route path="analyse/resultats" element={<AnalysisResults />} />
          <Route path="essayer" element={<Essayer />} />
          <Route path="essayer/:id" element={<Essayer />} />
          <Route path="labo" element={<Labo />} />
          <Route path="apercu/:id" element={<Apercu />} />
          <Route path="formes" element={<Formes />} />
          {/* old URLs */}
          <Route path="catalog" element={<Navigate to="/montures" replace />} />
          <Route path="product/:id" element={<OldProduct />} />
          <Route path="try-on" element={<Navigate to="/analyse" replace />} />
          <Route path="analysis-results" element={<Navigate to="/analyse/resultats" replace />} />
          <Route path="virtual-try-on" element={<Navigate to="/essayer" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
