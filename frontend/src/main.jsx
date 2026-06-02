import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import App from './App'
import GeneratedCoursesPage from './pages/GeneratedCoursesPage'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/course-builder" element={<App />} />
        <Route path="/course-builder/generated" element={<GeneratedCoursesPage />} />
        <Route path="*" element={<Navigate to="/course-builder" replace />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
)
