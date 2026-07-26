const api = {
  async request(method, url, body) {
    const res = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      let message = `Fehler ${res.status}`;
      try {
        const data = await res.json();
        if (data.error) message = data.error;
      } catch (e) {
        // ignore
      }
      throw new Error(message);
    }
    if (res.status === 204) return null;
    return res.json();
  },

  listProjects() {
    return this.request('GET', '/api/projects');
  },
  createProject(data) {
    return this.request('POST', '/api/projects', data);
  },
  getProject(id) {
    return this.request('GET', `/api/projects/${id}`);
  },
  updateProject(id, data) {
    return this.request('PUT', `/api/projects/${id}`, data);
  },
  deleteProject(id) {
    return this.request('DELETE', `/api/projects/${id}`);
  },

  listTickets(projectId) {
    return this.request('GET', `/api/projects/${projectId}/tickets`);
  },
  createTicket(projectId, data) {
    return this.request('POST', `/api/projects/${projectId}/tickets`, data);
  },
  updateTicket(projectId, ticketId, data) {
    return this.request('PUT', `/api/projects/${projectId}/tickets/${ticketId}`, data);
  },
  deleteTicket(projectId, ticketId) {
    return this.request('DELETE', `/api/projects/${projectId}/tickets/${ticketId}`);
  },
  generatePrompt(projectId, ticketId) {
    return this.request('POST', `/api/projects/${projectId}/tickets/${ticketId}/generate-prompt`);
  },
};
