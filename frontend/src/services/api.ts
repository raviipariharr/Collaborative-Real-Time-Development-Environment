import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3001/api';

const getAuthHeaders = () => {
  const token = localStorage.getItem('accessToken');
  return {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` })
  };
};

export const apiService = {
  async getProjects() {
    const response = await axios.get(`${API_BASE_URL}/projects`, {
      headers: getAuthHeaders()
    });
    return response.data;
  },

  async createProject(data: { name: string; description?: string; isPublic?: boolean }) {
    const response = await axios.post(`${API_BASE_URL}/projects`, data, {
      headers: getAuthHeaders()
    });
    return response.data;
  },

  async getProject(id: string) {
    const response = await axios.get(`${API_BASE_URL}/projects/${id}`, {
      headers: getAuthHeaders()
    });
    return response.data;
  },
  
  async updateProject(id: string, data: { name?: string; description?: string; isPublic?: boolean }) {
    const response = await axios.put(`${API_BASE_URL}/projects/${id}`, data, {
      headers: getAuthHeaders()
    });
    return response.data;
  },

  async deleteProject(id: string) {
    const response = await axios.delete(`${API_BASE_URL}/projects/${id}`, {
      headers: getAuthHeaders()
    });
    return response.data;
  },
  async createDocument(data: { projectId: string; name: string; language?: string }) {
    const response = await axios.post(`${API_BASE_URL}/documents`, data, {
      headers: getAuthHeaders()
    });
    return response.data;
  },

  async getProjectDocuments(projectId: string) {
    const response = await axios.get(`${API_BASE_URL}/documents/project/${projectId}`, {
      headers: getAuthHeaders()
    });
    return response.data;
  },
  // Invitations
  async sendInvitation(data: { projectId: string; email: string; role?: string }) {
    const response = await axios.post(`${API_BASE_URL}/invitations`, data, {
      headers: getAuthHeaders()
    });
    return response.data;
  },

  async getPendingInvitations() {
    const response = await axios.get(`${API_BASE_URL}/invitations/pending`, {
      headers: getAuthHeaders()
    });
    return response.data;
  },

  async acceptInvitation(invitationId: string) {
    const response = await axios.post(`${API_BASE_URL}/invitations/${invitationId}/accept`, {}, {
      headers: getAuthHeaders()
    });
    return response.data;
  },

  async rejectInvitation(invitationId: string) {
    const response = await axios.post(`${API_BASE_URL}/invitations/${invitationId}/reject`, {}, {
      headers: getAuthHeaders()
    });
    return response.data;
  },

  async getProjectInvitations(projectId: string) {
    const response = await axios.get(`${API_BASE_URL}/invitations/project/${projectId}`, {
      headers: getAuthHeaders()
    });
    return response.data;
  },

  async getProjectMessages(projectId: string) {
    const response = await axios.get(`${API_BASE_URL}/chat/project/${projectId}`, {
      headers: getAuthHeaders()
    });
    return response.data;
  },

  async sendChatMessage(data: { projectId: string; message: string }) {
    const response = await axios.post(`${API_BASE_URL}/chat`, data, {
      headers: getAuthHeaders()
    });
    return response.data;
  },
   async markMessagesAsRead(projectId: string) {
    const response = await axios.post(`${API_BASE_URL}/chat/mark-read`, 
      { projectId },
      { headers: getAuthHeaders() 

      });
    return response.data;
  },

  async getUnreadCount(projectId: string) {
    const response = await axios.get(`${API_BASE_URL}/chat/unread-count/${projectId}`, {
      headers: getAuthHeaders()
    });
    return response.data;
  }
};