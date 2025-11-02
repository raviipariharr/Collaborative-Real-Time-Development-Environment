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
  async createDocument(data: { projectId: string; name: string; language?: string; folderId?: string }) {
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
  },

  // Folders
  async getFolders(projectId: string) {
    const response = await axios.get(`${API_BASE_URL}/folders/project/${projectId}`, {
      headers: getAuthHeaders()
    });
    return response.data;
  },

  async createFolder(data: { projectId: string; name: string; parentId?: string }) {
    const response = await axios.post(`${API_BASE_URL}/folders`, data, {
      headers: getAuthHeaders()
    });
    return response.data;
  },

  async renameFolder(id: string, name: string) {
    const response = await axios.put(`${API_BASE_URL}/folders/${id}`, { name }, {
      headers: getAuthHeaders()
    });
    return response.data;
  },

  async deleteFolder(id: string) {
    const response = await axios.delete(`${API_BASE_URL}/folders/${id}`, {
      headers: getAuthHeaders()
    });
    return response.data;
  },

  async moveDocument(documentId: string, folderId: string | null) {
    const response = await axios.put(`${API_BASE_URL}/documents/${documentId}/move`, 
      { folderId },
      { headers: getAuthHeaders() }
    );
    return response.data;
  },

  async deleteDocument(id: string) {
  const response = await axios.delete(`${API_BASE_URL}/documents/${id}`, {
    headers: getAuthHeaders()
  });
  return response.data;
},

async renameDocument(id: string, name: string) {
  const response = await axios.put(`${API_BASE_URL}/documents/${id}/rename`, 
    { name },
    { headers: getAuthHeaders() }
  );
  return response.data;
},

async getDocument(id: string) {
    const response = await axios.get(`${API_BASE_URL}/documents/${id}`, {
      headers: getAuthHeaders()
    });
    return response.data;
  },

async saveDocumentContent(id: string, content: string) {
    const response = await axios.put(`${API_BASE_URL}/documents/${id}/content`, 
      { content },
      { headers: getAuthHeaders() }
    );
    return response.data;
  },

  async getProjectMembers(projectId: string) {
  const response = await axios.get(`${API_BASE_URL}/projects/${projectId}/members`, {
    headers: getAuthHeaders()
  });
  return response.data;
},

async updateMemberRole(memberId: string, role: 'ADMIN' | 'EDITOR' | 'VIEWER') {
  const response = await axios.put(`${API_BASE_URL}/members/${memberId}/role`, 
    { role },
    { headers: getAuthHeaders() }
  );
  return response.data;
},

async removeMember(memberId: string) {
  const response = await axios.delete(`${API_BASE_URL}/members/${memberId}`, {
    headers: getAuthHeaders()
  });
  return response.data;
},

async getFolderPermissions(folderId: string) {
  const response = await axios.get(`${API_BASE_URL}/folder-permissions/${folderId}`, {
    headers: getAuthHeaders()
  });
  return response.data;
},

async grantFolderPermission(folderId: string, data: { userId: string; canEdit: boolean; canDelete: boolean }) {
  const response = await axios.post(`${API_BASE_URL}/folder-permissions/${folderId}/grant`, data, {
    headers: getAuthHeaders()
  });
  return response.data;
},

async revokeFolderPermission(folderId: string, userId: string) {
  const response = await axios.delete(`${API_BASE_URL}/folder-permissions/${folderId}/revoke/${userId}`, {
    headers: getAuthHeaders()
  });
  return response.data;
},

async checkFolderEditPermission(folderId: string) {
  const response = await axios.get(`${API_BASE_URL}/folder-permissions/${folderId}/can-edit`, {
    headers: getAuthHeaders()
  });
  return response.data;
},

async getMemberPermissions(userId: string, projectId: string) {
  const response = await axios.get(`${API_BASE_URL}/member-permissions/user/${userId}/project/${projectId}`, {
    headers: getAuthHeaders()
  });
  return response.data;
},

async grantMemberPermission(data: {
  userId: string;
  projectId: string;
  type: 'folder' | 'document';
  resourceId: string;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const response = await axios.post(`${API_BASE_URL}/member-permissions/grant`, data, {
    headers: getAuthHeaders()
  });
  return response.data;
},

async updateMemberPermission(permissionId: string, data: { canEdit?: boolean; canDelete?: boolean }) {
  const response = await axios.put(`${API_BASE_URL}/member-permissions/${permissionId}`, data, {
    headers: getAuthHeaders()
  });
  return response.data;
},

async revokeMemberPermission(userId: string, type: 'folder' | 'document', resourceId: string) {
  const response = await axios.delete(
    `${API_BASE_URL}/member-permissions/user/${userId}/type/${type}/resource/${resourceId}`,
    { headers: getAuthHeaders() }
  );
  return response.data;
},

async checkDocumentEditPermission(documentId: string) {
  const response = await axios.get(`${API_BASE_URL}/documents/${documentId}/can-edit`, {
    headers: getAuthHeaders()
  });
  return response.data;
},

async getDocumentPermissions(documentId: string) {
  const response = await axios.get(`${API_BASE_URL}/document-permissions/${documentId}`, {
    headers: getAuthHeaders()
  });
  return response.data;
},

async grantDocumentPermission(documentId: string, data: { userId: string; canEdit: boolean; canDelete: boolean }) {
  const response = await axios.post(`${API_BASE_URL}/document-permissions/${documentId}/grant`, data, {
    headers: getAuthHeaders()
  });
  return response.data;
},

async revokeDocumentPermission(documentId: string, userId: string) {
  const response = await axios.delete(`${API_BASE_URL}/document-permissions/${documentId}/revoke/${userId}`, {
    headers: getAuthHeaders()
  });
  return response.data;
},

async sendChatMessage(data: { projectId: string; message: string; replyToId?: string; audioData?: string }) {
  const response = await axios.post(`${API_BASE_URL}/chat`, data, {
    headers: getAuthHeaders()
  });
  return response.data;
},

async deleteChatMessage(messageId: string) {
  const response = await axios.delete(`${API_BASE_URL}/chat/${messageId}`, {
    headers: getAuthHeaders()
  });
  return response.data;
},

async pinChatMessage(messageId: string, isPinned: boolean) {
  const response = await axios.put(`${API_BASE_URL}/chat/${messageId}/pin`, 
    { isPinned },
    { headers: getAuthHeaders() }
  );
  return response.data;
}

};