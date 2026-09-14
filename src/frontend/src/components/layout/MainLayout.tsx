import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

export const MainLayout: React.FC = () => {
  const [refreshTrigger] = useState<number>(0);

  return (
    <div className="flex h-screen overflow-hidden bg-[#0b0f17] text-slate-100">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Navigation */}
        <TopBar />

        {/* Scrollable Page Body */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[#0b0f17]">
          <div className="max-w-7xl mx-auto space-y-6">
            <Outlet context={{ refreshTrigger }} />
          </div>
        </main>
      </div>
    </div>
  );
};
