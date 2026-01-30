import React, { createContext, useContext, useReducer, useEffect } from 'react';
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3001/api';

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
    
    case 'CLEAR_ERROR':
      return { ...state, error: null };
    
    default:
      return state;
  }
};

const AuthContext = createContext<{
  state: AuthState;
  login: (googleToken: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}>({
  state: initialState,
  login: async () => {},
  logout: async () => {},
  clearError: () => {}
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  useEffect(() => {
    const initAuth = async () => {
      dispatch({ type: 'INIT_START' });
      
      if (state.accessToken) {
        try {
          const response = await axios.get(`${API_BASE_URL}/auth/me`, {
            headers: { 'Authorization': `Bearer ${state.accessToken}` }
          });
          
          if (response.data) {
            dispatch({
              type: 'LOGIN_SUCCESS',
              payload: {
                user: response.data,
                accessToken: state.accessToken!,
                refreshToken: state.refreshToken!
              }
            });
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
  }, [state.accessToken, state.initialized, state.refreshToken]);

  const login = async (googleToken: string) => {
    try {
      dispatch({ type: 'LOGIN_START' });
      
      const response = await axios.post(`${API_BASE_URL}/auth/google`, {
        token: googleToken
      });

      if (response.data.success) {
        dispatch({
          type: 'LOGIN_SUCCESS',
          payload: {
            user: response.data.user,
            accessToken: response.data.accessToken,
            refreshToken: response.data.refreshToken
          }
        });
      } else {
        throw new Error(response.data.error || 'Login failed');
      }
    } catch (error) {
      const errorMessage = axios.isAxiosError(error) 
        ? error.response?.data?.error || 'Login failed'
        : 'Login failed';
      
      dispatch({ type: 'LOGIN_ERROR', payload: errorMessage });
      throw error;
    }
  };

  const logout = async () => {
    try {
      if (state.refreshToken && state.accessToken) {
        await axios.post(`${API_BASE_URL}/auth/logout`, 
          { refreshToken: state.refreshToken },
          { headers: { 'Authorization': `Bearer ${state.accessToken}` }}
        );
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      dispatch({ type: 'LOGOUT' });
    }
  };

  const clearError = () => {
    dispatch({ type: 'CLEAR_ERROR' });
  };

  return (
    <AuthContext.Provider value={{ state, login, logout, clearError }}>
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