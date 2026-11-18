import { Suspense, lazy } from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import Catalog from './pages/Catalog';
import ProductDetail from './pages/ProductDetail';
import AnalysisResults from './pages/AnalysisResults';

// Heavy routes (TensorFlow.js, three.js) are split out of the main bundle.
const TryOn = lazy(() => import('./pages/TryOn'));
const VirtualTryOn = lazy(() => import('./components/VirtualTryOn'));

const Loading = () => <div className="min-h-screen pt-20 bg-sand-50" />;

function App() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="catalog" element={<Catalog />} />
          <Route path="product/:id" element={<ProductDetail />} />
          <Route path="try-on" element={<TryOn />} />
          <Route path="analysis-results" element={<AnalysisResults />} />
          <Route path="virtual-try-on" element={<VirtualTryOn />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

export default App;
