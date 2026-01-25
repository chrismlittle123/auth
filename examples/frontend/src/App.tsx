import { SignInButton, SignOutButton, useAuth, useUser } from '@clerk/clerk-react';
import { useState } from 'react';

const API_URL = 'http://localhost:3001';

interface ApiResponse {
  status: 'success' | 'error';
  data?: unknown;
  error?: string;
}

function App() {
  const { isSignedIn, getToken } = useAuth();
  const { user } = useUser();
  const [response, setResponse] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const callApi = async (endpoint: string) => {
    setLoading(true);
    setResponse(null);

    try {
      const token = await getToken();

      const res = await fetch(`${API_URL}${endpoint}`, {
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
        },
      });

      const data = await res.json();

      setResponse({
        status: res.ok ? 'success' : 'error',
        data: res.ok ? data : undefined,
        error: !res.ok ? JSON.stringify(data, null, 2) : undefined,
      });
    } catch (err) {
      setResponse({
        status: 'error',
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1>🔐 Auth Package Test</h1>

      <div className="card">
        <h2>Authentication</h2>
        {isSignedIn ? (
          <div>
            <p className="success">✅ Signed in as {user?.primaryEmailAddress?.emailAddress}</p>
            <SignOutButton>
              <button className="danger">Sign Out</button>
            </SignOutButton>
          </div>
        ) : (
          <div>
            <p>Not signed in</p>
            <SignInButton mode="modal">
              <button className="primary">Sign In</button>
            </SignInButton>
          </div>
        )}
      </div>

      <div className="card">
        <h2>API Tests</h2>
        <p>Click to test backend endpoints:</p>

        <div>
          <button className="secondary" onClick={() => callApi('/health')}>
            /health (public)
          </button>
          <button className="secondary" onClick={() => callApi('/api/public')}>
            /api/public (public)
          </button>
          <button className="primary" onClick={() => callApi('/api/me')} disabled={!isSignedIn}>
            /api/me (protected)
          </button>
          <button className="primary" onClick={() => callApi('/api/admin')} disabled={!isSignedIn}>
            /api/admin (admin role)
          </button>
          <button className="primary" onClick={() => callApi('/api/debug')} disabled={!isSignedIn}>
            /api/debug (full context)
          </button>
        </div>
      </div>

      {loading && <div className="card">Loading...</div>}

      {response && (
        <div className="card">
          <h2>Response {response.status === 'success' ? '✅' : '❌'}</h2>
          <pre>
            {response.status === 'success'
              ? JSON.stringify(response.data, null, 2)
              : response.error
            }
          </pre>
        </div>
      )}
    </div>
  );
}

export default App;
