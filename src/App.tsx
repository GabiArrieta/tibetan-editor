import React, { useEffect } from 'react'
import { AppShell } from './components/layout/AppShell'
import { useDocumentStore } from './store/documentStore'
import { exampleDocument } from './seed/exampleDocument'

export default function App() {
  const loadDocument = useDocumentStore(s => s.loadDocument)

  // Load example document on first run if no autosave exists
  useEffect(() => {
    const hasAutosave = !!localStorage.getItem('tibetan-editor:autosave')
    if (!hasAutosave) {
      loadDocument(exampleDocument)
    }
  }, [])

  return <AppShell />
}
