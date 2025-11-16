import axios from 'axios';

const apiClient = axios.create({
    baseURL: 'http://localhost:8000/api/',
});

// Use an interceptor to dynamically add the JWT token to every request header
apiClient.interceptors.request.use(
    (config) => {
        // Get the token from localStorage (or wherever you've stored it)
        const token = localStorage.getItem('authToken');

        if (token) {
            // If the token exists, add the 'Authorization' header
            config.headers['Authorization'] = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        // Do something with the request error
        return Promise.reject(error);
    }
);

export default apiClient;