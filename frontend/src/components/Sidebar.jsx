import { useState, useEffect } from 'react';
import { getHealth } from '../services/api';

/**
 * Sidebar showing system status and document info.
 * Will be expanded with file upload and analytics in the future.
 */
export default function Sidebar() {
  const [health, setHealth] = useState(null);

  useEffect(() => {
    getHealth()
      .then(setHealth)
      .catch(() => setHealth(null));
  }, []);

  return (
    <div className="hidden lg:flex flex-col gap-4 w-72">
      {/* Status card */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${health ? 'bg-green-500' : 'bg-red-500'}`} />
          System Status
        </h3>

        {health ? (
          <div className="space-y-2 text-sm text-gray-600">
            <div className="flex justify-between">
              <span>Documents</span>
              <span className="font-medium text-gray-800">{health.docs}</span>
            </div>
            <div className="flex justify-between">
              <span>Chunks indexed</span>
              <span className="font-medium text-gray-800">{health.chunks.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span>API</span>
              <span className="text-green-600 font-medium">Online</span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-red-500">Unable to connect to backend</p>
        )}
      </div>

      {/* Info card */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">About</h3>
        <p className="text-xs text-gray-500 leading-relaxed">
          RAG-powered pharmacy assistant. Uses FAISS vector search to find relevant
          information from pharmaceutical documents, then generates accurate
          responses with GPT-4o-mini.
        </p>
      </div>
    </div>
  );
}
