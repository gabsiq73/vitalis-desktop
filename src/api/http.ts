import axios, { type AxiosInstance } from 'axios';

let baseURL = 'http://localhost:8080';

// Independente da sessão: cadastro público nunca envia Basic Auth.
export const publicHttp = axios.create({ baseURL, timeout: 15000 });

export function configureApi(url: string) {
  baseURL = url;
  publicHttp.defaults.baseURL = url;
}

export function createHttpClient(username: string, password: string): AxiosInstance {
  return axios.create({
    baseURL,
    headers: {
      Authorization: `Basic ${btoa(`${username}:${password}`)}`,
    },
  });
}
