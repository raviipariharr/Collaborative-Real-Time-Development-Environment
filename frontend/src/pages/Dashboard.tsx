// frontend/src/pages/Dashboard.tsx - NEW FILE
import React from 'react';
import { useAuth } from '../contexts/AuthContext';

const Dashboard: React.FC = () => {
  const { state, logout } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <span className="text-2xl mr-2">💻</span>
              <h1 className="text-xl font-bold text-gray-900">CodeCollab</h1>
            </div>
            
            <div className="flex items-center space-x-4">
              {state.user?.avatar && (
                <img 
                  src={state.user.avatar} 
                  alt={state.user.name}
                  className="w-8 h-8 rounded-full"
                />
              )}
              <span className="text-sm text-gray-700">{state.user?.name}</span>
              <button
                onClick={logout}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Welcome to CodeCollab! 👋
          </h2>
          <p className="text-lg text-gray-600 mb-8">
            Your collaborative coding environment is ready. Let's build something amazing together!
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {/* Feature Cards */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="text-4xl mb-4">⚡</div>
              <h3 className="text-xl font-semibold mb-2">Real-time Collaboration</h3>
              <p className="text-gray-600">Code together with your team in real-time</p>
            </div>
            
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="text-4xl mb-4">🔐</div>
              <h3 className="text-xl font-semibold mb-2">Secure Authentication</h3>
              <p className="text-gray-600">Protected by Google OAuth 2.0</p>
            </div>
            
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="text-4xl mb-4">📱</div>
              <h3 className="text-xl font-semibold mb-2">Cross-Platform</h3>
              <p className="text-gray-600">Works on web, mobile, and desktop</p>
            </div>
          </div>
          
          {/* Coming Soon */}
          <div className="mt-12">
            <div className="bg-blue-50 rounded-lg p-8">
              <h3 className="text-2xl font-semibold text-blue-900 mb-4">Coming in Step 3</h3>
              <div className="flex justify-center space-x-8 text-blue-700">
                <span>🎨 Monaco Editor</span>
                <span>📁 Project Management</span>
                <span>💬 Live Chat</span>
                <span>👥 Team Collaboration</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;