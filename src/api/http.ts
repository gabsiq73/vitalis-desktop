import axios, { type AxiosInstance } from 'axios';

const BASE_URL = 'http://localhost:8080';

export function createHttpClient(username: string, password: string): AxiosInstance {
  return axios.create({
    baseURL: BASE_URL,
    headers: {
      Authorization: `Basic ${btoa(`${username}:${password}`)}`,
    },
  });
}
