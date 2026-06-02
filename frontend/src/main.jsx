import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import App from './App'
import GeneratedCoursesPage from './pages/GeneratedCoursesPage'
import CourseLibraryPage from './pages/CourseLibraryPage'
import CourseOverviewPage from './pages/CourseOverviewPage'
import SectionPlayerPage from './pages/SectionPlayerPage'
import QuizPlayerPage from './pages/QuizPlayerPage'
import FinalAssignmentPage from './pages/FinalAssignmentPage'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/course-builder" element={<App />} />
        <Route path="/course-builder/generated" element={<GeneratedCoursesPage />} />
        <Route path="/learn" element={<CourseLibraryPage />} />
        <Route path="/learn/:courseId" element={<CourseOverviewPage />} />
        <Route path="/learn/:courseId/section/:sectionId" element={<SectionPlayerPage />} />
        <Route path="/learn/:courseId/quiz/:moduleNumber" element={<QuizPlayerPage />} />
        <Route path="/learn/:courseId/assignment" element={<FinalAssignmentPage />} />
        <Route path="*" element={<Navigate to="/course-builder" replace />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
)
