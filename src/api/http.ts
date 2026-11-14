import axios, { type AxiosInstance } from 'axios';

const BASE_URL = 'http://localhost:8080';

// Independente da sessão: cadastro público nunca envia Basic Auth.
export const publicHttp = axios.create({ baseURL: BASE_URL, timeout: 15000 });

export function createHttpClient(username: string, password: string): AxiosInstance {
  return axios.create({
    baseURL: BASE_URL,
    headers: {
      Authorization: `Basic ${btoa(`${username}:${password}`)}`,
    },
  });
}
