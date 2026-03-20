/**
 * RightPanel — properties panel with tabs: Row / Document / Fonts
 */

import React from 'react'
import { useEditorStore } from '../../store/editorStore'
import { RowPropertiesPanel } from '../panels/RowPropertiesPanel'
import { DocumentPropertiesPanel } from '../panels/DocumentPropertiesPanel'
import { FontManagerPanel } from '../panels/FontManagerPanel'
import type { RightPanelTab } from '../../types/editor'

const TABS: { id: RightPanelTab; label: string }[] = [
  { id: 'row', label: 'Fila' },
  { id: 'document', label: 'Página' },
  { id: 'fonts', label: 'Fuentes' },
]

export function RightPanel() {
  const rightPanelTab = useEditorStore(s => s.rightPanelTab)
  const setRightPanelTab = useEditorStore(s => s.setRightPanelTab)

  return (
    <aside className="w-56 bg-slate-900 border-l border-slate-700/50 flex flex-col min-h-0">
      {/* Tab bar */}
      <div className="flex border-b border-slate-700/50 shrink-0">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setRightPanelTab(tab.id)}
            className={[
              'flex-1 py-2 text-[11px] font-medium transition-colors',
              rightPanelTab === tab.id
                ? 'text-indigo-400 border-b-2 border-indigo-400'
                : 'text-slate-500 hover:text-slate-300',
            ].join(' ')}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Panel content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {rightPanelTab === 'row' && <RowPropertiesPanel />}
        {rightPanelTab === 'document' && <DocumentPropertiesPanel />}
        {rightPanelTab === 'fonts' && <FontManagerPanel />}
      </div>
    </aside>
  )
}
