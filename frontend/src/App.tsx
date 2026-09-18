import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { OverviewPage } from '@/pages/overview'
import { SpendPage } from '@/pages/spend'
import { TrafficPage } from '@/pages/traffic'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<OverviewPage />} />
        <Route path="/traffic" element={<TrafficPage />} />
        <Route path="/spend" element={<SpendPage />} />
        {/* Phase 2+ surfaces are navigable only once built. */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
