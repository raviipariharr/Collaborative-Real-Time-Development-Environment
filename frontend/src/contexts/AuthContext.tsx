// frontend/src/contexts/AuthContext.tsx
import React, { createContext, useContext, useReducer, useEffect } from 'react';

interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role: string;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  loading: boolean;
  error: string | null;
  initialized: boolean;
}

type AuthAction = 
  | { type: 'INIT_START' }
  | { type: 'INIT_COMPLETE' }
  | { type: 'LOGIN_START' }
  | { type: 'LOGIN_SUCCESS'; payload: { user: User; accessToken: string; refreshToken: string } }
  | { type: 'LOGIN_ERROR'; payload: string }
  | { type: 'LOGOUT' }
  | { type: 'REFRESH_TOKEN'; payload: string }
  | { type: 'CLEAR_ERROR' };

const initialState: AuthState = {
  user: null,
  accessToken: localStorage.getItem('accessToken'),
  refreshToken: localStorage.getItem('refreshToken'),
  loading: false,
  error: null,
  initialized: false
};

const authReducer = (state: AuthState, action: AuthAction): AuthState => {
  switch (action.type) {
    case 'INIT_START':
      return { ...state, loading: true };
    
    case 'INIT_COMPLETE':
      return { ...state, loading: false, initialized: true };
    
    case 'LOGIN_START':
      return { ...state, loading: true, error: null };
    
    case 'LOGIN_SUCCESS':
      localStorage.setItem('accessToken', action.payload.accessToken);
      localStorage.setItem('refreshToken', action.payload.refreshToken);
      return {
        ...state,
        user: action.payload.user,
        accessToken: action.payload.accessToken,
        refreshToken: action.payload.refreshToken,
        loading: false,
        error: null,
        initialized: true
      };
    
    case 'LOGIN_ERROR':
      return { ...state, loading: false, error: action.payload };
    
    case 'LOGOUT':
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      return {
        ...state,
        user: null,
        accessToken: null,
        refreshToken: null,
        loading: false,
        error: null
      };
    
    case 'REFRESH_TOKEN':
      localStorage.setItem('accessToken', action.payload);
      return { ...state, accessToken: action.payload };
    
    case 'CLEAR_ERROR':
      return { ...state, error: null };
    
    default:
      return state;
  }
};

const AuthContext = createContext<{
  state: AuthState;
  login: (googleToken: string) => Promise<void>;
  logout: () => void;
  refreshToken: () => Promise<void>;
  clearError: () => void;
}>({
  state: initialState,
  login: async () => {},
  logout: () => {},
  refreshToken: async () => {},
  clearError: () => {}
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Initialize auth state on app start
  useEffect(() => {
    const initAuth = async () => {
      dispatch({ type: 'INIT_START' });
      
      if (state.accessToken) {
        try {
          // Try to get current user to validate token
          const response = await fetch('http://localhost:3001/api/auth/me', {
            headers: {
              'Authorization': `Bearer ${state.accessToken}`
            }
          });
          
          if (response.ok) {
            const user = await response.json();
            dispatch({
              type: 'LOGIN_SUCCESS',
              payload: {
                user,
                accessToken: state.accessToken!,
                refreshToken: state.refreshToken!
              }
            });
          } else {
            // Token is invalid, clear it
            dispatch({ type: 'LOGOUT' });
          }
        } catch (error) {
          dispatch({ type: 'LOGOUT' });
        }
      }
      
      dispatch({ type: 'INIT_COMPLETE' });
    };

    if (!state.initialized) {
      initAuth();
    }
  }, [state.accessToken, state.initialized]);

  const login = async (googleToken: string) => {
    try {
      dispatch({ type: 'LOGIN_START' });
      
      const response = await fetch('http://localhost:3001/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: googleToken })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Authentication failed');
      }

      const data = await response.json();
      
      dispatch({
        type: 'LOGIN_SUCCESS',
        payload: {
          user: data.user,
          accessToken: data.accessToken,
          refreshToken: data.refreshToken
        }
      });
    } catch (error) {
      dispatch({
        type: 'LOGIN_ERROR',
        payload: error instanceof Error ? error.message : 'Login failed'
      });
    }
  };

  const logout = async () => {
    try {
      // Call backend logout endpoint
      if (state.refreshToken) {
        await fetch('http://localhost:3001/api/auth/logout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(state.accessToken && { 'Authorization': `Bearer ${state.accessToken}` })
          },
          body: JSON.stringify({ refreshToken: state.refreshToken })
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      dispatch({ type: 'LOGOUT' });
    }
  };

  const refreshToken = async () => {
    if (!state.refreshToken) return;
    
    try {
      const response = await fetch('http://localhost:3001/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: state.refreshToken })
      });

      if (response.ok) {
        const data = await response.json();
        dispatch({ type: 'REFRESH_TOKEN', payload: data.accessToken });
      } else {
        dispatch({ type: 'LOGOUT' });
      }
    } catch (error) {
      dispatch({ type: 'LOGOUT' });
    }
  };

  const clearError = () => {
    dispatch({ type: 'CLEAR_ERROR' });
  };

  return (
    <AuthContext.Provider value={{ state, login, logout, refreshToken, clearError }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};